#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  TIERS,
  TIER_MODELS,
  CONFIG_FILENAME,
  MANAGED_FILENAME,
  repoRootFromHere,
  resolveTargetDir,
  installDirFor,
  loadJsoncFile,
  writeFileMode,
  expandEnv,
  redactConfig,
  redactText,
  isTier,
  modelForTier,
  loadModelsFile,
  getPreset,
  applyPreset,
  validateConfig,
  loadProjectConfig,
  readManifest,
  collectPackFiles,
  installPack,
  updatePack,
  uninstallPack,
  doctor,
} from "./lib.mjs";
import { sendNotification, CHANNELS } from "../hooks/notify.mjs";

const REPO_ROOT = repoRootFromHere(import.meta.url);

const HELP = `omm — oh-my-muse pack manager

Usage: omm <command> [options]

Commands:
  setup [--dir <path>]              Write a default omm.jsonc (0600) if missing
  install [--dir <path>]            Install pack into <dir>/.claude/oh-my-muse (staging + atomic)
  update [--dir <path>]             Update the installed pack (staging + atomic)
  uninstall [--dir <path>]          Remove files tracked in omm-managed.json
  doctor [--dir <path>]             Check node, config, tiers, webhooks, permissions
  list [--dir <path>] [--json]      List configured agents
  preset <name> [--dir <path>]      Show a preset, or --apply <agent> to apply it
  config <get|set|show> [key] [v]   Read or modify omm.jsonc (values support $ENV expansion)
  skill <list> [--dir <path>]       List installed skills
  notify --channel <c> --message <m> Send a notification (telegram|discord|slack|file)

Global options: --dir <path>  Target project dir (default: cwd). Paths are absolute.
Env: OMM_DIR overrides --dir. Secrets in output are redacted; webhooks must be https.
`;

function parseArgs(argv) {
  const out = { _: [], dir: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir" || a === "--target") out.dir = argv[++i] ?? null;
    else if (a.startsWith("--dir=")) out.dir = a.slice(6);
    else if (a === "--json") out.json = true;
    else if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) out[a.slice(2, eq)] = a.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[a.slice(2)] = argv[++i];
      else out[a.slice(2)] = "true";
    } else out._.push(a);
  }
  return out;
}

function targetOf(args) {
  return resolveTargetDir(process.cwd(), args.dir ?? process.env.OMM_DIR ?? ".");
}

function fail(err) {
  console.error(redactText(err?.message ?? String(err)));
  process.exit(1);
}

function defaultConfigText() {
  return `// oh-my-muse configuration (JSONC). Secrets may use $ENV references.
{
  // Default tier for agents that do not declare one.
  "defaultTier": "balanced", // ${TIERS.join(" | ")}
  "agents": [],
  "notify": {}
}
`;
}

function cmdSetup(args) {
  const target = targetOf(args);
  const file = path.join(installDirFor(target), CONFIG_FILENAME);
  if (fs.existsSync(file)) {
    console.log(`Exists: ${file}`);
    return;
  }
  writeFileMode(file, defaultConfigText());
  console.log(`Created ${file} (0600)`);
}

function cmdInstall(args) {
  const target = targetOf(args);
  const { dest, files } = installPack({ repoRoot: REPO_ROOT, targetDir: target });
  console.log(`Installed ${files.length} files to ${dest}`);
}

function cmdUpdate(args) {
  const target = targetOf(args);
  const { dest, files } = updatePack({ repoRoot: REPO_ROOT, targetDir: target });
  console.log(`Updated ${files.length} files in ${dest}`);
}

function cmdUninstall(args) {
  const target = targetOf(args);
  const { dest, removed } = uninstallPack({ targetDir: target });
  console.log(removed.length === 0 ? `Nothing tracked; cleaned ${dest}` : `Removed ${removed.length} files from ${dest}`);
}

function cmdDoctor(args) {
  const target = targetOf(args);
  const checks = doctor({ repoRoot: REPO_ROOT, targetDir: target });
  let failed = 0;
  for (const c of checks) {
    console.log(`${c.ok ? "ok  " : "FAIL"}  ${c.message}`);
    if (!c.ok) failed++;
  }
  if (failed > 0) process.exit(1);
}

function cmdList(args) {
  const target = targetOf(args);
  const { config, file } = loadProjectConfig(target);
  if (!config) fail(`No config at ${file}; run: omm setup --dir ${target}`);
  const defTier = config.defaultTier ?? "balanced";
  const agents = (config.agents ?? []).map((a) => ({
    name: a.name,
    tier: a.tier ?? defTier,
    model: a.model ?? (isTier(a.tier ?? defTier) ? TIER_MODELS[a.tier ?? defTier] : "(invalid tier)"),
    description: a.description ?? "",
  }));
  if (args.json) {
    console.log(JSON.stringify(redactConfig(agents), null, 2));
    return;
  }
  if (agents.length === 0) console.log(`No agents configured (${file})`);
  for (const a of agents) console.log(`${a.name}  [${a.tier}]  ${a.model}  ${a.description}`);
}

function cmdPreset(args) {
  const target = targetOf(args);
  const name = args._[1];
  if (!name) fail("Usage: omm preset <name> [--apply <agent>] [--dir <path>]");
  const models = loadModelsFile(REPO_ROOT);
  const preset = getPreset(models, name);
  if (args.apply) {
    const { config, file } = loadProjectConfig(target);
    if (!config) fail(`No config at ${file}; run: omm setup --dir ${target}`);
    const agentName = String(args.apply);
    const idx = (config.agents ?? []).findIndex((a) => a.name === agentName);
    if (idx === -1) fail(`Agent "${agentName}" not found in ${file}`);
    config.agents[idx] = applyPreset(config.agents[idx], preset);
    validateConfig(expandEnv(config));
    const raw = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    void raw;
    writeFileMode(file, `${JSON.stringify(config, null, 2)}\n`);
    console.log(`Applied preset "${name}" to agent "${agentName}" in ${file}`);
    return;
  }
  console.log(JSON.stringify(redactConfig(preset), null, 2));
}

function getPath(obj, dotted) {
  return dotted.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}

function setPath(obj, dotted, value) {
  const keys = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] === undefined || typeof cur[keys[i]] !== "object") cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function coerceValue(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function cmdConfig(args) {
  const target = targetOf(args);
  const sub = args._[1] ?? "show";
  const { config, file } = loadProjectConfig(target);
  if (sub === "show") {
    if (!config) fail(`No config at ${file}; run: omm setup --dir ${target}`);
    console.log(JSON.stringify(redactConfig(expandEnv(config)), null, 2));
    return;
  }
  if (sub === "get") {
    const key = args._[2];
    if (!key) fail("Usage: omm config get <dotted.key>");
    if (!config) fail(`No config at ${file}`);
    const val = getPath(expandEnv(config), key);
    console.log(JSON.stringify(redactConfig(val), null, 2) ?? "null");
    return;
  }
  if (sub === "set") {
    const key = args._[2];
    const rawVal = args._[3] ?? args.value;
    if (!key || rawVal === undefined) fail("Usage: omm config set <dotted.key> <json-or-string>");
    if (!config) fail(`No config at ${file}; run: omm setup --dir ${target}`);
    const base = loadJsoncFile(file);
    setPath(base, key, coerceValue(String(rawVal)));
    if (key === "defaultTier" || key.endsWith(".tier")) {
      const t = getPath(base, key);
      if (!isTier(t)) fail(`tier must be one of ${TIERS.join("|")}`);
      void modelForTier(t);
    }
    validateConfig(expandEnv(base));
    writeFileMode(file, `${JSON.stringify(base, null, 2)}\n`);
    console.log(`Set ${key} in ${file}`);
    return;
  }
  fail(`Unknown config subcommand "${sub}"; expected get|set|show`);
}

function cmdSkill(args) {
  const target = targetOf(args);
  const sub = args._[1] ?? "list";
  if (sub !== "list") fail(`Unknown skill subcommand "${sub}"; expected list`);
  const skillsDir = path.join(installDirFor(target), "pack", "skills");
  const repoSkills = path.join(REPO_ROOT, "pack", "skills");
  const dir = fs.existsSync(skillsDir) ? skillsDir : repoSkills;
  if (!fs.existsSync(dir)) fail(`No skills found under ${dir}`);
  const names = fs.readdirSync(dir).filter((n) => fs.statSync(path.join(dir, n)).isDirectory()).sort();
  for (const n of names) console.log(n);
}

async function cmdNotify(args) {
  const channel = String(args.channel ?? args._[1] ?? "");
  const message = String(args.message ?? args.text ?? args._[2] ?? "");
  if (!CHANNELS.includes(channel)) fail(`Usage: omm notify --channel ${CHANNELS.join("|")} --message <text>`);
  if (!message) fail("notify requires --message <text>");
  const target = targetOf(args);
  const { config } = loadProjectConfig(target);
  const named = String(args.hook ?? args.name ?? "");
  const hook = { ...((named && config?.notify?.[named]) || config?.notify?.[channel] || {}) };
  if (args.url) hook.url = String(args.url);
  if (args.webhookUrl) hook.webhookUrl = String(args.webhookUrl);
  if (args.botToken) hook.botToken = String(args.botToken);
  if (args.chatId) hook.chatId = String(args.chatId);
  if (args.file) hook.file = String(args.file);
  await sendNotification({ channel, message, projectName: args.project, vars: {}, hook });
  console.log(`Notified via ${channel}.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(HELP);
    return;
  }
  try {
    switch (cmd) {
      case "setup": cmdSetup(args); break;
      case "install": cmdInstall(args); break;
      case "update": cmdUpdate(args); break;
      case "uninstall": cmdUninstall(args); break;
      case "doctor": cmdDoctor(args); break;
      case "list": cmdList(args); break;
      case "preset": cmdPreset(args); break;
      case "config": cmdConfig(args); break;
      case "skill": cmdSkill(args); break;
      case "notify": await cmdNotify(args); break;
      default: fail(`Unknown command "${cmd}". Run: omm help`);
    }
  } catch (err) {
    fail(err);
  }
}

await main();

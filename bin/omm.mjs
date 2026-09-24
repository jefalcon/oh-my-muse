#!/usr/bin/env node
import path from "node:path";
import {
  PLUGIN_ID,
  pluginDirFromHere,
  findMuse,
  requireMuse,
  runMuse,
  museVersion,
  validatePlugin,
  installArgs,
  redactText,
} from "./lib.mjs";
import fs from "node:fs";
import {
  sendNotification,
  CHANNELS,
  notifyConfigPath,
  readNotifyConfigFile,
  applyEnvOverrides,
  writeNotifyConfig,
  isSecureConfigMode,
} from "../plugin/hooks/notify.mjs";

const PLUGIN_DIR = pluginDirFromHere(import.meta.url);

const HELP = `omm — oh-my-muse native plugin manager

Usage: omm <command> [options]

Commands:
  install [--scope user|project]  Install the plugin into Muse (prints the pending approve step)
  uninstall                       Remove ${PLUGIN_ID} from Muse
  validate                        Run both real validators (skills, then plugin)
  doctor                          Check node, muse in PATH, muse version, validation, notify config
  notify setup --channel <c> [...]  Write $HOME/.config/oh-my-muse/notify.json (mode 0600)
  notify test [--message <m>]     Send a notification using the config file
  notify --channel <c> --message <m>
                                  Send a notification (telegram|discord|slack|file)

Config file ($HOME/.config/oh-my-muse/notify.json; XDG_CONFIG_HOME is NOT
used): channel, webhookUrl, botToken, chatId, file, message,
allowExternalFile, includeAssistantMessage. Secrets live only there and
are never printed. For CLI use, OMM_* variables override the file; the
Stop hook reads ONLY the file (Muse filters hook env, and Stop fires at
the end of every turn).
Env: OMM_NOTIFY_CHANNEL, OMM_NOTIFY_MESSAGE, OMM_NOTIFY_FILE,
OMM_NOTIFY_ALLOW_EXTERNAL=1, OMM_NOTIFY_WEBHOOK_URL, TELEGRAM_BOT_TOKEN /
TELEGRAM_CHAT_ID, DISCORD_WEBHOOK_URL, SLACK_WEBHOOK_URL. Secrets in
output are redacted; webhooks must be https (discord/slack host
allowlists enforced). File-channel notes land inside the cwd unless
allowed externally; an explicit notify --file <path> always opts out.
`;

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) out[a.slice(2, eq)] = a.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[a.slice(2)] = argv[++i];
      else out[a.slice(2)] = "true";
    } else out._.push(a);
  }
  return out;
}

function fail(err) {
  console.error(redactText(err?.message ?? String(err)));
  process.exit(1);
}

function cmdInstall(args) {
  const scope = args.scope !== undefined ? String(args.scope) : undefined;
  const argv = installArgs(PLUGIN_DIR, scope);
  const res = runMuse(argv);
  if (res.status !== 0) fail(`muse ${argv.join(" ")} failed: ${res.stderr || res.stdout}`);
  process.stdout.write(res.stdout);
  console.log(`Installed ${PLUGIN_ID} from ${PLUGIN_DIR}.`);
  console.log(`Pending step (not executed): run \`muse plugins approve ${PLUGIN_ID}\` yourself to trust and enable it.`);
}

function cmdUninstall() {
  const res = runMuse(["plugins", "remove", PLUGIN_ID]);
  if (res.status !== 0) fail(`muse plugins remove ${PLUGIN_ID} failed: ${res.stderr || res.stdout}`);
  process.stdout.write(res.stdout);
  console.log(`Removed ${PLUGIN_ID}.`);
}

function cmdValidate() {
  requireMuse();
  const results = validatePlugin({ pluginDir: PLUGIN_DIR });
  for (const s of results.skills) console.log(`ok   skill ${path.basename(s.dir)}`);
  console.log("ok   plugin");
  console.log(`Validated ${results.skills.length} skills + plugin.`);
}

function cmdDoctor() {
  let failed = 0;
  const check = (ok, message) => {
    console.log(`${ok ? "ok  " : "FAIL"}  ${message}`);
    if (!ok) failed++;
  };
  const major = Number(process.versions.node.split(".")[0]);
  check(major >= 20, `node >= 20 (found ${process.version})`);
  const musePath = findMuse();
  check(musePath !== null, musePath ? `muse in PATH (${musePath})` : "muse in PATH (missing: install Muse Code and add `muse` to PATH)");
  if (musePath) {
    try {
      check(true, `muse version: ${museVersion({ musePath })}`);
    } catch (err) {
      check(false, `muse --version failed: ${err.message}`);
    }
    try {
      const results = validatePlugin({ pluginDir: PLUGIN_DIR, musePath });
      check(true, `validators pass (${results.skills.length} skills + plugin)`);
    } catch (err) {
      check(false, `validation: ${err.message}`);
    }
  }
  // Notify config file: existence, permissions, channel. Never print secrets.
  try {
    const cfgPath = notifyConfigPath();
    if (!fs.existsSync(cfgPath)) {
      console.log("ok   notify config: not configured (hook is silent)");
    } else {
      const mode = fs.statSync(cfgPath).mode & 0o777;
      if (!isSecureConfigMode(mode)) {
        check(false, `notify config is group/other-readable (mode ${mode.toString(8)}): run chmod 600 ${cfgPath}`);
      } else {
        const cfg = readNotifyConfigFile(cfgPath);
        const channel = String(cfg.channel ?? "(unset)");
        check(true, `notify config: ${cfgPath} (mode ${mode.toString(8)}, channel=${channel})`);
      }
    }
  } catch (err) {
    check(false, `notify config: ${redactText(err?.message ?? String(err))}`);
  }
  if (failed > 0) process.exit(1);
}

function truthyFlag(value) {
  if (value === undefined) return undefined;
  const s = String(value).toLowerCase();
  return !(s === "false" || s === "0" || s === "no");
}

async function cmdNotifySetup(args) {
  const channel = String(args.channel ?? args._[1] ?? "");
  if (!CHANNELS.includes(channel)) fail(`Usage: omm notify setup --channel ${CHANNELS.join("|")} [options]`);
  const config = { channel };
  const webhookUrl = args.webhookUrl ?? args["webhook-url"] ?? args.url;
  if (webhookUrl !== undefined) config.webhookUrl = String(webhookUrl);
  const botToken = args.botToken ?? args["bot-token"];
  if (botToken !== undefined) config.botToken = String(botToken);
  const chatId = args.chatId ?? args["chat-id"];
  if (chatId !== undefined) config.chatId = String(chatId);
  if (args.file !== undefined) config.file = String(args.file);
  const message = args.message ?? args.text;
  if (message !== undefined) config.message = String(message);
  const allowExternal = truthyFlag(args.allowExternalFile ?? args["allow-external-file"]);
  if (allowExternal !== undefined) config.allowExternalFile = allowExternal;
  const includeAssistant = truthyFlag(
    args.includeAssistantMessage ?? args["include-assistant-message"] ?? args.includeAssistant,
  );
  if (includeAssistant !== undefined) config.includeAssistantMessage = includeAssistant;
  const file = writeNotifyConfig(config);
  // NEVER print secrets: only the path, mode, and non-secret channel.
  console.log(`Wrote ${file} (mode 600, channel=${channel}).`);
}

async function cmdNotifyTest(args) {
  const fileCfg = readNotifyConfigFile(notifyConfigPath());
  const cfg = applyEnvOverrides(fileCfg);
  const channel = String(cfg.channel ?? "");
  if (!CHANNELS.includes(channel)) fail("notify test: no channel configured (run: omm notify setup --channel <c>)");
  const message = args.message ?? args.text ?? cfg.message ?? "oh-my-muse: test notification";
  const hook = {
    webhookUrl: cfg.webhookUrl ?? args.webhookUrl ?? args.url,
    url: cfg.webhookUrl ?? args.webhookUrl ?? args.url,
    botToken: cfg.botToken ?? args.botToken,
    chatId: cfg.chatId ?? args.chatId,
    file: args.file ?? cfg.file,
  };
  const allowExternalFile = args.file !== undefined
    ? true
    : (cfg.allowExternalFile === true || process.env.OMM_NOTIFY_ALLOW_EXTERNAL === "1");
  const result = await sendNotification({
    channel,
    message: String(message),
    projectName: args.project,
    vars: {},
    hook,
    root: process.cwd(),
    allowExternalFile,
  });
  if (channel === "file") console.log(`Notified via file: ${result.file}`);
  else console.log(`Notified via ${channel}.`);
}

async function cmdNotify(args) {
  const sub = String(args._[1] ?? "");
  if (sub === "setup") return cmdNotifySetup({ ...args, _: [args._[0], ...args._.slice(2)] });
  if (sub === "test") return cmdNotifyTest({ ...args, _: [args._[0], ...args._.slice(2)] });
  // Direct send (kept for on-demand use): CLI flags win, then OMM_* env,
  // then the config file.
  const fileCfg = readNotifyConfigFile(notifyConfigPath());
  const cfg = applyEnvOverrides(fileCfg);
  const channel = String(args.channel ?? cfg.channel ?? args._[1] ?? "");
  const message = String(args.message ?? args.text ?? cfg.message ?? args._[2] ?? "");
  if (!CHANNELS.includes(channel)) fail(`Usage: omm notify --channel ${CHANNELS.join("|")} --message <text>`);
  if (!message) fail("notify requires --message <text>");
  const hook = {};
  if (args.url) hook.url = String(args.url);
  if (args.webhookUrl) hook.webhookUrl = String(args.webhookUrl);
  else if (cfg.webhookUrl) hook.webhookUrl = cfg.webhookUrl;
  if (args.botToken) hook.botToken = String(args.botToken);
  else if (cfg.botToken) hook.botToken = cfg.botToken;
  if (args.chatId) hook.chatId = String(args.chatId);
  else if (cfg.chatId) hook.chatId = cfg.chatId;
  // An explicit --file flag is the user's own action and opts out of root
  // confinement; an env-driven path stays confined unless explicitly allowed.
  const explicitFile = args.file ? String(args.file) : null;
  if (explicitFile) hook.file = explicitFile;
  else if (process.env.OMM_NOTIFY_FILE) hook.file = process.env.OMM_NOTIFY_FILE;
  else if (cfg.file) hook.file = cfg.file;
  const allowExternalFile = explicitFile !== null
    || process.env.OMM_NOTIFY_ALLOW_EXTERNAL === "1"
    || cfg.allowExternalFile === true;
  const result = await sendNotification({
    channel,
    message,
    projectName: args.project,
    vars: {},
    hook,
    root: process.cwd(),
    allowExternalFile,
  });
  if (channel === "file") console.log(`Notified via file: ${result.file}`);
  else console.log(`Notified via ${channel}.`);
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
      case "install": cmdInstall(args); break;
      case "uninstall": cmdUninstall(); break;
      case "validate": cmdValidate(); break;
      case "doctor": cmdDoctor(); break;
      case "notify": await cmdNotify(args); break;
      default: fail(`Unknown command "${cmd}". Run: omm help`);
    }
  } catch (err) {
    fail(err);
  }
}

await main();

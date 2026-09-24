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
import { sendNotification, CHANNELS } from "../plugin/hooks/notify.mjs";

const PLUGIN_DIR = pluginDirFromHere(import.meta.url);

const HELP = `omm — oh-my-muse native plugin manager

Usage: omm <command> [options]

Commands:
  install [--scope user|project]  Install the plugin into Muse (prints the pending approve step)
  uninstall                       Remove ${PLUGIN_ID} from Muse
  validate                        Run both real validators (skills, then plugin)
  doctor                          Check node, muse in PATH, muse version, validation
  notify --channel <c> --message <m>
                                  Send a notification (telegram|discord|slack|file)

Env: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID, DISCORD_WEBHOOK_URL,
SLACK_WEBHOOK_URL, OMM_NOTIFY_FILE. Secrets in output are redacted;
webhooks must be https (discord/slack host allowlists enforced).
File-channel notes land inside the cwd unless OMM_NOTIFY_ALLOW_EXTERNAL=1;
an explicit notify --file <path> always opts out.
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
  if (failed > 0) process.exit(1);
}

async function cmdNotify(args) {
  const channel = String(args.channel ?? args._[1] ?? "");
  const message = String(args.message ?? args.text ?? args._[2] ?? "");
  if (!CHANNELS.includes(channel)) fail(`Usage: omm notify --channel ${CHANNELS.join("|")} --message <text>`);
  if (!message) fail("notify requires --message <text>");
  const hook = {};
  if (args.url) hook.url = String(args.url);
  if (args.webhookUrl) hook.webhookUrl = String(args.webhookUrl);
  if (args.botToken) hook.botToken = String(args.botToken);
  if (args.chatId) hook.chatId = String(args.chatId);
  // An explicit --file flag is the user's own action and opts out of root
  // confinement; an env-driven path stays confined unless explicitly allowed.
  const explicitFile = args.file ? String(args.file) : null;
  if (explicitFile) hook.file = explicitFile;
  else if (process.env.OMM_NOTIFY_FILE) hook.file = process.env.OMM_NOTIFY_FILE;
  const allowExternalFile = explicitFile !== null || process.env.OMM_NOTIFY_ALLOW_EXTERNAL === "1";
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

import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { expandEnvInString, assertHttps, redactText, resolveNotificationFile, validateWebhookUrl } from "../bin/lib.mjs";

export const CHANNELS = ["telegram", "discord", "slack", "file"];

export function renderTemplate(template, vars) {
  return String(template).replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (m, name) => {
    const val = vars[name];
    return val === undefined || val === null ? m : String(val);
  });
}

function postJson(urlStr, payload, { timeoutMs = 15000 } = {}) {
  const url = new URL(assertHttps(urlStr, "notify"));
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) },
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => { data += c; });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve({ ok: true, status: res.statusCode, body: data });
          else reject(new Error(`Notify POST failed with status ${res.statusCode}: ${redactText(data.slice(0, 500))}`));
        });
      }
    );
    req.on("error", (err) => reject(new Error(`Notify POST failed: ${err.message}`)));
    req.on("timeout", () => req.destroy(new Error("Notify POST timed out")));
    req.write(body);
    req.end();
  });
}

export async function sendTelegram({ botToken, chatId, text }) {
  const token = expandEnvInString(String(botToken));
  const id = expandEnvInString(String(chatId));
  if (!token || !id) throw new Error("telegram requires botToken and chatId");
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  return postJson(url, { chat_id: id, text: String(text) });
}

export async function sendDiscord({ webhookUrl, text }) {
  const url = validateWebhookUrl("discord", expandEnvInString(String(webhookUrl)));
  return postJson(url, { content: String(text).slice(0, 2000) });
}

export async function sendSlack({ webhookUrl, text }) {
  const url = validateWebhookUrl("slack", expandEnvInString(String(webhookUrl)));
  return postJson(url, { text: String(text) });
}

export async function sendFile({ file, text, root = process.cwd(), allowExternalFile = false }) {
  const dest = resolveNotificationFile(root, expandEnvInString(String(file)), allowExternalFile);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.appendFileSync(dest, `${new Date().toISOString()} ${String(text)}\n`);
  return { ok: true, file: dest };
}

export function baseVars({ projectName, extra = {} } = {}) {
  return {
    projectName: projectName ?? process.env.OMM_PROJECT ?? path.basename(path.resolve(".")),
    date: new Date().toISOString(),
    host: process.env.HOSTNAME ?? "",
    ...extra,
  };
}

export async function sendNotification({ channel, message, projectName, vars = {}, hook = {}, root = process.cwd(), allowExternalFile = false }) {
  if (!CHANNELS.includes(channel)) throw new Error(`Unknown channel "${channel}"; expected ${CHANNELS.join("|")}`);
  const text = renderTemplate(expandEnvInString(String(message ?? hook.text ?? "")), baseVars({ projectName, extra: vars }));
  if (!text) throw new Error("Notification message is empty after template rendering");
  switch (channel) {
    case "telegram":
      return sendTelegram({ botToken: hook.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? "", chatId: hook.chatId ?? process.env.TELEGRAM_CHAT_ID ?? "", text });
    case "discord":
      return sendDiscord({ webhookUrl: hook.webhookUrl ?? hook.url ?? process.env.DISCORD_WEBHOOK_URL ?? "", text });
    case "slack":
      return sendSlack({ webhookUrl: hook.webhookUrl ?? hook.url ?? process.env.SLACK_WEBHOOK_URL ?? "", text });
    case "file":
      return sendFile({ file: hook.file ?? process.env.OMM_NOTIFY_FILE ?? "omm-notify.log", text, root, allowExternalFile });
    default:
      throw new Error(`Unhandled channel "${channel}"`);
  }
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) out[a.slice(2, eq)] = a.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) { out[a.slice(2)] = argv[++i]; }
      else out[a.slice(2)] = "true";
    } else out._.push(a);
  }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const channel = String(args.channel ?? args._[0] ?? "");
  const message = String(args.message ?? args.text ?? args._[1] ?? "");
  const hook = {};
  if (args.url) hook.url = String(args.url);
  if (args.webhookUrl) hook.webhookUrl = String(args.webhookUrl);
  if (args.botToken) hook.botToken = String(args.botToken);
  if (args.chatId) hook.chatId = String(args.chatId);
  if (args.file) hook.file = String(args.file);
  try {
    if (!channel) throw new Error("Usage: notify.mjs --channel telegram|discord|slack|file --message <text> [--url ...]");
    // An explicit --file flag is the user's own action and opts out of root
    // confinement; a config-driven path stays confined to the cwd project.
    const result = await sendNotification({ channel, message, projectName: args.project, vars: {}, hook, root: process.cwd(), allowExternalFile: Boolean(args.file) });
    if (channel === "file") console.log(`Notified via file: ${result.file}`);
    else console.log(`Notified via ${channel}.`);
  } catch (err) {
    console.error(redactText(err.message));
    process.exit(1);
  }
}

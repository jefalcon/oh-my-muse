/**
 * oh-my-muse notify hook (self-contained: node builtins only).
 *
 * Invoked by the runtime as `["node", "hooks/notify.mjs"]` on the `Stop`
 * (end of turn) and `SessionEnd` (end of session) events. The hook payload
 * shape is not documented, so stdin is read leniently: any JSON, empty
 * input, or unreadable stdin still yields a generic notification.
 *
 * Configuration is env-only (hook argv is fixed):
 *   OMM_NOTIFY_CHANNEL=telegram|discord|slack|file   (unset/empty/off = silent no-op)
 *   OMM_NOTIFY_MESSAGE="optional {{projectName}} {{event}} {{date}} template"
 *   TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
 *   DISCORD_WEBHOOK_URL / SLACK_WEBHOOK_URL           (https + host allowlist enforced)
 *   OMM_NOTIFY_FILE=omm-notify.log                   (confined to cwd unless OPT-IN below)
 *   OMM_NOTIFY_ALLOW_EXTERNAL=1                       (opt out of root confinement)
 *   OMM_PROJECT=<name>                               (defaults to cwd basename)
 *
 * Security preserved from the CLI notifier: https-only webhooks with the
 * discord/slack host allowlists, secret redaction on every diagnostic, and
 * file-channel confinement to the project root (lexical + symlink realpath
 * check). The hook NEVER fails the turn: all errors are redacted to stderr
 * and the process exits 0.
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";

export const CHANNELS = ["telegram", "discord", "slack", "file"];
export const EVENTS = ["Stop", "SessionEnd"];

export function expandEnvInString(str, env = process.env) {
  return String(str).replace(/\$(\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}|([A-Za-z_][A-Za-z0-9_]*))/g, (m, _g, braced, def, plain) => {
    const name = braced ?? plain;
    const val = env[name];
    if (val !== undefined) return val;
    if (def !== undefined) return def;
    return m;
  });
}

const SENSITIVE_KEY = /(token|secret|password|passwd|api[_-]?key|auth|bearer|webhook|private[_-]?key)/i;

export function redactValue(key, value) {
  if (typeof value === "string" && SENSITIVE_KEY.test(key ?? "")) {
    if (value.length === 0) return value;
    return "[redacted]";
  }
  return value;
}

export function redactText(text) {
  return String(text)
    .replace(/(bot\d+:[A-Za-z0-9_-]{10,})/g, "[redacted]")
    .replace(/(xox[bpas]-[A-Za-z0-9-]{8,})/g, "[redacted]")
    .replace(/https?:\/\/(?:www\.|m\.)?(?:discord\.com|discordapp\.com)\/api\/webhooks\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+/g, "[redacted-discord-webhook]")
    .replace(/https?:\/\/hooks\.slack(?:-gov)?\.com\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+/g, "[redacted-slack-webhook]")
    .replace(/(-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----)/g, "[redacted]");
}

export function assertHttps(urlStr, label = "webhook") {
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    throw new Error(`${label} URL is not a valid URL: ${redactText(urlStr)}`);
  }
  if (u.protocol !== "https:") throw new Error(`${label} URL must use https:, got ${u.protocol}`);
  return u.toString();
}

function isInside(root, candidate) {
  const rel = path.relative(path.resolve(root), path.resolve(candidate));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** Resolve a notification file and keep it inside the project root unless opted out. */
export function resolveNotificationFile(root, configured, allowExternal = false) {
  const target = path.resolve(path.resolve(root), String(configured));
  if (!allowExternal && !isInside(root, target)) {
    throw new Error("refusing notification file outside project root (set OMM_NOTIFY_ALLOW_EXTERNAL=1 to opt in)");
  }
  // If the target (or an existing parent) goes through a symlink, verify its
  // real path as well so a path that is lexically inside the project cannot
  // escape through a symlinked directory.
  if (!allowExternal) {
    const rootReal = fs.realpathSync(path.resolve(root));
    let probe = fs.existsSync(target) ? target : path.dirname(target);
    while (!fs.existsSync(probe)) {
      const parent = path.dirname(probe);
      if (parent === probe) break;
      probe = parent;
    }
    if (fs.existsSync(probe)) {
      const real = fs.realpathSync(probe);
      if (!isInside(rootReal, real)) {
        throw new Error("refusing notification file through a symlink outside project root");
      }
    }
  }
  return target;
}

/** Validate literal/resolved Slack and Discord webhook destinations. */
export function validateWebhookUrl(channel, raw) {
  let url;
  try {
    url = new URL(String(raw));
  } catch {
    throw new Error(`invalid ${channel} webhook URL`);
  }
  if (url.protocol !== "https:") throw new Error(`${channel} webhook must use https`);
  if (channel === "slack") {
    const hosts = new Set(["hooks.slack.com", "hooks.slack-gov.com"]);
    if (!hosts.has(url.hostname) || !url.pathname.startsWith("/services/")) {
      throw new Error("slack webhook must use hooks.slack.com (or hooks.slack-gov.com) /services/...");
    }
  } else if (channel === "discord") {
    const hosts = new Set(["discord.com", "www.discord.com", "discordapp.com", "www.discordapp.com"]);
    if (!hosts.has(url.hostname) || !url.pathname.startsWith("/api/webhooks/")) {
      throw new Error("discord webhook must use a Discord /api/webhooks/... URL");
    }
  }
  return url.toString();
}

export function renderTemplate(template, vars) {
  return String(template).replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (m, name) => {
    const val = vars[name];
    return val === undefined || val === null ? m : String(val);
  });
}

function postJson(urlStr, payload, { timeoutMs = 8000 } = {}) {
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
    req.on("error", (err) => reject(new Error(`Notify POST failed: ${redactText(err.message)}`)));
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

/** Best-effort notification. Never throws past this point uncaught by the caller. */
export async function sendNotification({ channel, message, projectName, vars = {}, hook = {}, root = process.cwd(), allowExternalFile = false }) {
  if (!CHANNELS.includes(channel)) throw new Error(`Unknown channel "${channel}"; expected ${CHANNELS.join("|")}`);
  const text = redactText(renderTemplate(expandEnvInString(String(message ?? hook.text ?? "")), baseVars({ projectName, extra: vars })));
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

/** Read hook stdin leniently: empty, non-JSON, or unreadable input yields {}. */
export function readHookPayload() {
  try {
    if (process.stdin.isTTY) return {};
    const raw = fs.readFileSync(0, "utf8");
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function eventFromPayload(payload) {
  const raw = payload?.event ?? payload?.hook_event ?? payload?.hookEvent ?? payload?.type ?? "";
  if (EVENTS.includes(raw)) return raw;
  return "Stop";
}

export async function runHook(defaultEvent = "Stop") {
  const channel = String(process.env.OMM_NOTIFY_CHANNEL ?? "").toLowerCase();
  try {
    if (!channel || channel === "off" || channel === "none") process.exit(0);
    const payload = readHookPayload();
    const raw = payload?.event ?? payload?.hook_event ?? payload?.hookEvent ?? payload?.type ?? defaultEvent;
    const event = EVENTS.includes(raw) ? raw : defaultEvent;
    const message = process.env.OMM_NOTIFY_MESSAGE
      ?? (event === "SessionEnd"
        ? "oh-my-muse: session ended in {{projectName}} at {{date}}"
        : "oh-my-muse: turn finished in {{projectName}} at {{date}}");
    const result = await sendNotification({
      channel,
      message,
      hook: {},
      root: process.cwd(),
      allowExternalFile: process.env.OMM_NOTIFY_ALLOW_EXTERNAL === "1",
      vars: { event },
    });
    if (channel === "file") console.log(`Notified via file: ${result.file}`);
    else console.log(`Notified via ${channel}.`);
  } catch (err) {
    console.error(redactText(err?.message ?? String(err)));
  } finally {
    process.exit(0);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;

if (isMain) {
  await runHook("Stop");
}

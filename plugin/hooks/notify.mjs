/**
 * oh-my-muse notify hook (self-contained: node builtins only).
 *
 * Invoked by the runtime as `["node", "hooks/notify.mjs"]` on the `Stop`
 * (end of turn) event. `Stop` fires at the end of EVERY turn, including
 * under `muse exec`.
 *
 * The runtime filters the hook environment: only a fixed allowlist
 * (HOME, LANG, PATH, ...) reaches the hook, so NO OMM_* variable and no
 * XDG_CONFIG_HOME is visible here. Configuration therefore lives in a
 * fixed file, resolved via os.homedir() (never XDG_CONFIG_HOME):
 *
 *   $HOME/.config/oh-my-muse/notify.json
 *
 * Fields: channel (telegram|discord|slack|file|off), webhookUrl,
 * botToken, chatId, file, message, allowExternalFile,
 * includeAssistantMessage (bool, default false). Secrets live only here.
 *
 * Security, preserved from the CLI notifier: https-only webhooks with the
 * discord/slack host allowlists, secret redaction on every diagnostic,
 * and file-channel confinement to the payload `cwd` project root
 * (lexical + symlink realpath check). A config file readable beyond its
 * owner (mode & 0o077) is refused: the hook sends nothing. Input that is
 * not a JSON object on stdin is also a silent no-op. The hook NEVER
 * fails the turn: all errors are redacted to stderr and the process
 * always exits 0.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const CHANNELS = ["telegram", "discord", "slack", "file", "off"];
export const HOOK_EVENT = "Stop";

/** Fixed config location. Uses os.homedir(); XDG_CONFIG_HOME is ignored. */
export function notifyConfigPath(home = os.homedir()) {
  return path.join(home, ".config", "oh-my-muse", "notify.json");
}

export function notifyConfigDir(home = os.homedir()) {
  return path.dirname(notifyConfigPath(home));
}

/** True when no group/other permission bit is set (0600, 0400, ...). */
export function isSecureConfigMode(mode) {
  return (Number(mode) & 0o077) === 0;
}

/** Read and parse the config file. Returns {} when missing/unreadable. Throws nothing. */
export function readNotifyConfigFile(configPath = notifyConfigPath()) {
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Env overrides for CLI use only (`omm notify`). The hook never calls
 * this: it reads the file and ignores the environment.
 */
export function applyEnvOverrides(fileCfg = {}, env = process.env) {
  const out = { ...(fileCfg ?? {}) };
  if (env.OMM_NOTIFY_CHANNEL) out.channel = env.OMM_NOTIFY_CHANNEL;
  if (env.OMM_NOTIFY_MESSAGE) out.message = env.OMM_NOTIFY_MESSAGE;
  if (env.OMM_NOTIFY_FILE) out.file = env.OMM_NOTIFY_FILE;
  if (env.OMM_NOTIFY_ALLOW_EXTERNAL === "1") out.allowExternalFile = true;
  else if (env.OMM_NOTIFY_ALLOW_EXTERNAL === "0") out.allowExternalFile = false;
  const webhook = env.OMM_NOTIFY_WEBHOOK_URL ?? env.DISCORD_WEBHOOK_URL ?? env.SLACK_WEBHOOK_URL;
  if (webhook) out.webhookUrl = webhook;
  if (env.TELEGRAM_BOT_TOKEN) out.botToken = env.TELEGRAM_BOT_TOKEN;
  if (env.TELEGRAM_CHAT_ID) out.chatId = env.TELEGRAM_CHAT_ID;
  if (env.OMM_NOTIFY_INCLUDE_ASSISTANT === "1") out.includeAssistantMessage = true;
  else if (env.OMM_NOTIFY_INCLUDE_ASSISTANT === "0") out.includeAssistantMessage = false;
  return out;
}

/**
 * Write the config file with mode 0600, creating the directory with
 * 0700. Returns the config path. Never logs secrets (callers must not
 * print the returned config values either).
 */
export function writeNotifyConfig(config, home = os.homedir()) {
  const dir = notifyConfigDir(home);
  fs.mkdirSync(dir, { recursive: true });
  fs.chmodSync(dir, 0o700);
  const file = notifyConfigPath(home);
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return file;
}

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

async function postJson(urlStr, payload, { timeoutMs = 8000 } = {}) {
  const url = assertHttps(urlStr, "notify");
  const res = await globalThis.fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.ok) return { ok: true, status: res.status, body: await res.text() };
  throw new Error(`Notify POST failed with status ${res.status}: ${redactText((await res.text()).slice(0, 500))}`);
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
  const name = String(channel ?? "").toLowerCase();
  if (!CHANNELS.includes(name)) throw new Error(`Unknown channel "${channel}"; expected ${CHANNELS.join("|")}`);
  const text = redactText(renderTemplate(expandEnvInString(String(message ?? hook.text ?? "")), baseVars({ projectName, extra: vars })));
  if (!text) throw new Error("Notification message is empty after template rendering");
  switch (name) {
    case "telegram":
      return sendTelegram({ botToken: hook.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? "", chatId: hook.chatId ?? process.env.TELEGRAM_CHAT_ID ?? "", text });
    case "discord":
      return sendDiscord({ webhookUrl: hook.webhookUrl ?? hook.url ?? process.env.DISCORD_WEBHOOK_URL ?? "", text });
    case "slack":
      return sendSlack({ webhookUrl: hook.webhookUrl ?? hook.url ?? process.env.SLACK_WEBHOOK_URL ?? "", text });
    case "file":
      return sendFile({ file: hook.file ?? process.env.OMM_NOTIFY_FILE ?? "omm-notify.log", text, root, allowExternalFile });
    default:
      throw new Error(`Unhandled channel "${name}"`);
  }
}

/**
 * Read hook stdin tolerantly: any input that does not parse to a JSON
 * object (empty, non-JSON, or unreadable) yields null, and the caller
 * must exit 0 WITHOUT sending. Never throws.
 */
export function readHookPayload() {
  try {
    if (process.stdin.isTTY) return null;
    const raw = fs.readFileSync(0, "utf8");
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Template vars for the Stop hook, from the payload's cwd (fallback: process.cwd()). */
export function hookVarsFromPayload(payload, cwd) {
  return {
    projectName: path.basename(path.resolve(cwd)),
    event: payload?.hook_event_name ?? payload?.event ?? payload?.hook_event ?? HOOK_EVENT,
    date: new Date().toISOString(),
    model: payload?.model ?? "",
    sessionId: payload?.session_id ?? payload?.sessionId ?? "",
  };
}

export async function runHook() {
  const configPath = notifyConfigPath();
  try {
    let stat;
    try {
      stat = fs.statSync(configPath);
    } catch {
      process.exit(0); // no config: silent no-op
    }
    if (!isSecureConfigMode(stat.mode)) {
      console.error("notify config is group/other-readable; refusing to send");
      process.exit(0);
    }
    const cfg = readNotifyConfigFile(configPath);
    const channel = String(cfg.channel ?? "").toLowerCase();
    if (!channel || channel === "off" || channel === "none") process.exit(0);
    if (!CHANNELS.includes(channel)) process.exit(0);
    const payload = readHookPayload();
    if (!payload) process.exit(0); // invalid stdin: exit 0 without sending
    if (payload.stop_hook_active === true) process.exit(0);
    // The hook reads ONLY the file: OMM_* and other env vars are ignored.
    const cwd = typeof payload?.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
    const vars = hookVarsFromPayload(payload, cwd);
    const template = cfg.message ?? "oh-my-muse: turn finished in {{projectName}} at {{date}}";
    let text = redactText(renderTemplate(String(template), vars));
    if (!text) process.exit(0);
    if (cfg.includeAssistantMessage === true && typeof payload?.last_assistant_message === "string" && payload.last_assistant_message) {
      text += `\n\n${redactText(payload.last_assistant_message.slice(0, 500))}`;
    }
    // Default every field to "" so sendNotification never falls back to
    // process.env: the hook reads ONLY the file.
    const hook = {
      webhookUrl: cfg.webhookUrl ?? "",
      url: cfg.webhookUrl ?? "",
      botToken: cfg.botToken ?? "",
      chatId: cfg.chatId ?? "",
      file: cfg.file ?? "omm-notify.log",
    };
    const allowExternalFile = cfg.allowExternalFile === true;
    const result = await sendNotification({
      channel,
      message: text,
      projectName: vars.projectName,
      vars: {},
      hook,
      root: cwd,
      allowExternalFile,
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
  await runHook();
}

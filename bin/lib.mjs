import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const PLUGIN_ID = "oh-my-muse";

export function repoRootFromHere(importMetaUrl) {
  return path.resolve(path.dirname(new URL(importMetaUrl).pathname), "..");
}

export function pluginDirFromHere(importMetaUrl) {
  return path.join(repoRootFromHere(importMetaUrl), "plugin");
}

export function resolveTargetDir(cwd, target) {
  if (!target) return path.resolve(cwd);
  return path.isAbsolute(target) ? path.normalize(target) : path.resolve(cwd, target);
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

export function expandEnv(value, env = process.env) {
  if (typeof value === "string") return expandEnvInString(value, env);
  if (Array.isArray(value)) return value.map((v) => expandEnv(v, env));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = expandEnv(v, env);
    return out;
  }
  return value;
}

const SENSITIVE_KEY = /(token|secret|password|passwd|api[_-]?key|auth|bearer|webhook|private[_-]?key)/i;

export function redactValue(key, value) {
  if (typeof value === "string" && SENSITIVE_KEY.test(key ?? "")) {
    if (value.length === 0) return value;
    return "[redacted]";
  }
  return value;
}

export function redactConfig(value, key = "") {
  if (Array.isArray(value)) return value.map((v) => redactConfig(v, key));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== null && typeof v === "object") out[k] = redactConfig(v, k);
      else out[k] = redactValue(k, v);
    }
    return out;
  }
  return redactValue(key, value);
}

export function configHasSecrets(value, key = "") {
  if (Array.isArray(value)) return value.some((v) => configHasSecrets(v, key));
  if (value && typeof value === "object") {
    return Object.entries(value).some(([k, v]) =>
      (typeof v === "string" && v.length > 0 && SENSITIVE_KEY.test(k)) || configHasSecrets(v, k),
    );
  }
  return false;
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

/** Find the `muse` CLI on PATH. Returns the absolute path or null. */
export function findMuse(env = process.env) {
  const pathVar = env.PATH ?? env.Path ?? "";
  const dirs = pathVar.split(path.delimiter).filter(Boolean);
  const names = process.platform === "win32" ? ["muse.cmd", "muse.exe", "muse"] : ["muse"];
  for (const dir of dirs) {
    for (const name of names) {
      const full = path.join(dir, name);
      try {
        if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
      } catch {
        // keep searching
      }
    }
  }
  return null;
}

export function requireMuse(env = process.env) {
  const found = findMuse(env);
  if (!found) {
    throw new Error("muse CLI not found in PATH. Install Muse Code 1.3.0+ and ensure `muse` is on PATH.");
  }
  return found;
}

export function runMuse(args, { musePath } = {}) {
  const bin = musePath ?? requireMuse();
  const res = spawnSync(bin, args, { encoding: "utf8" });
  if (res.error) throw new Error(`failed to run muse: ${res.error.message}`);
  return { status: res.status ?? 1, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

export function museVersion({ musePath } = {}) {
  const res = runMuse(["--version"], { musePath });
  if (res.status !== 0) throw new Error(`muse --version failed: ${redactText(res.stderr || res.stdout)}`);
  return res.stdout.trim().split("\n")[0];
}

export function listSkillDirs(pluginDir) {
  const skillsRoot = path.join(pluginDir, "skills");
  return fs.readdirSync(skillsRoot)
    .filter((n) => {
      try {
        return fs.statSync(path.join(skillsRoot, n)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort()
    .map((n) => path.join(skillsRoot, n));
}

function parseValidatorJson(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`${label}: validator returned non-JSON output: ${redactText(stdout.slice(0, 500))}`);
  }
}

/**
 * Run both real validators: every skill dir, then the whole plugin.
 * Returns { skills: [{ dir, valid }], plugin: { valid } }. Throws on any
 * failure or when `muse` is missing.
 */
export function validatePlugin({ pluginDir, musePath } = {}) {
  const results = { skills: [], plugin: null };
  for (const dir of listSkillDirs(pluginDir)) {
    const res = runMuse(["skills", "validate", dir, "--json"], { musePath });
    const doc = parseValidatorJson(res.stdout, `skills validate ${dir}`);
    const diags = doc.diagnostics ?? [];
    const ok = res.status === 0 && doc.valid === true && diags.length === 0;
    results.skills.push({ dir, valid: ok, diagnostics: diags });
    if (!ok) throw new Error(`skill invalid: ${dir}: ${redactText(JSON.stringify(diags).slice(0, 500))}`);
  }
  const res = runMuse(["plugins", "validate", pluginDir, "--json"], { musePath });
  const doc = parseValidatorJson(res.stdout, "plugins validate");
  const diags = doc.diagnostics ?? doc?.error ?? [];
  const ok = res.status === 0 && doc.valid === true && Array.isArray(diags) && diags.length === 0;
  results.plugin = { valid: ok, diagnostics: Array.isArray(diags) ? diags : [diags] };
  if (!ok) throw new Error(`plugin invalid: ${redactText(JSON.stringify(results.plugin.diagnostics).slice(0, 1000))}`);
  return results;
}

export function installArgs(pluginDir, scope) {
  if (scope !== undefined && scope !== "user" && scope !== "project") {
    throw new Error(`--scope must be user|project, got "${scope}"`);
  }
  return ["plugins", "install", pluginDir, ...(scope ? ["--scope", scope] : [])];
}

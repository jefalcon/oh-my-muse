import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const TIERS = ["budget", "balanced", "premium"];

export const TIER_MODELS = {
  budget: "muse-spark-fast",
  balanced: "muse-spark",
  premium: "muse-spark-reasoning",
};

export const INSTALL_DIRNAME = path.join(".claude", "oh-my-muse");
export const CONFIG_FILENAME = "omm.jsonc";
export const MANAGED_FILENAME = "omm-managed.json";
export const CONFIG_MODE = 0o600;

export function repoRootFromHere(importMetaUrl) {
  return path.resolve(path.dirname(new URL(importMetaUrl).pathname), "..");
}

export function resolveTargetDir(cwd, target) {
  if (!target) return path.resolve(cwd);
  return path.isAbsolute(target) ? path.normalize(target) : path.resolve(cwd, target);
}

export function installDirFor(targetDir) {
  return path.join(path.resolve(targetDir), INSTALL_DIRNAME);
}

export function stripJsonc(text) {
  let out = "";
  let inStr = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inLine) {
      if (c === "\n") { inLine = false; out += c; }
      continue;
    }
    if (inBlock) {
      if (c === "*" && n === "/") { inBlock = false; i++; }
      else if (c === "\n") out += c;
      continue;
    }
    if (inStr) {
      out += c;
      if (c === "\\") { out += n ?? ""; i++; }
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === "/" && n === "/") { inLine = true; i++; continue; }
    if (c === "/" && n === "*") { inBlock = true; i++; continue; }
    out += c;
  }
  return out;
}

export function parseJsonc(text, sourceLabel = "config") {
  try {
    return JSON.parse(stripJsonc(text));
  } catch (err) {
    throw new Error(`Invalid JSONC in ${sourceLabel}: ${err.message}`);
  }
}

export function loadJsoncFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return parseJsonc(text, filePath);
}

export function writeFileMode(filePath, content, mode = CONFIG_MODE) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, { mode });
  fs.chmodSync(filePath, mode);
}

export function expandEnvInString(str, env = process.env) {
  return str.replace(/\$(\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}|([A-Za-z_][A-Za-z0-9_]*))/g, (m, _g, braced, def, plain) => {
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
    throw new Error("refusing notification file outside project root (set allowExternalNotificationFile=true to opt in)");
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

export function validateNotifyHook(name, hook) {
  if (!hook || typeof hook !== "object") throw new Error(`notify.${name} must be an object`);
  if (hook.channel !== undefined && !["telegram", "discord", "slack", "file"].includes(hook.channel)) {
    throw new Error(`notify.${name}.channel must be telegram|discord|slack|file`);
  }
  if (hook.url !== undefined) assertHttps(expandEnvInString(String(hook.url)), `notify.${name}`);
  if (hook.webhookUrl !== undefined) {
    const expanded = expandEnvInString(String(hook.webhookUrl));
    if (hook.channel === "discord" || hook.channel === "slack") validateWebhookUrl(hook.channel, expanded);
    else assertHttps(expanded, `notify.${name}`);
  }
}

export function isTier(value) {
  return TIERS.includes(value);
}

export function modelForTier(tier) {
  if (!isTier(tier)) throw new Error(`Unknown tier "${tier}"; expected one of ${TIERS.join("|")}`);
  return TIER_MODELS[tier];
}

export function loadModelsFile(repoRoot) {
  const file = path.join(repoRoot, "models.json");
  if (!fs.existsSync(file)) return { tiers: {}, presets: {}, customPresets: {} };
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function getPreset(models, name) {
  return resolvePreset(models, name);
}

/**
 * Resolve a preset by name. Builtin presets resolve as-is. Custom presets are
 * partial overlays: without `extends` they inherit `{ tier: "balanced" }` (or
 * the same-name builtin when overriding one); with `extends` they inherit the
 * named builtin or custom preset. Inheritance cycles are rejected.
 */
export function resolvePreset(models, name, seen = new Set()) {
  const builtins = models.presets ?? {};
  const customs = models.customPresets ?? {};
  const custom = customs[name];
  if (!custom) {
    const preset = builtins[name];
    if (!preset) {
      const all = [...Object.keys(builtins), ...Object.keys(customs)];
      throw new Error(`Unknown preset "${name}". Available: ${all.join(", ") || "(none)"}`);
    }
    return { ...preset };
  }
  if (seen.has(name)) throw new Error(`custom preset inheritance cycle at "${name}"`);
  seen.add(name);
  let base;
  if (custom.extends === undefined) {
    base = builtins[name] ? { ...builtins[name] } : { tier: "balanced" };
  } else if (customs[custom.extends]) {
    base = resolvePreset(models, custom.extends, seen);
  } else if (builtins[custom.extends]) {
    base = { ...builtins[custom.extends] };
  } else {
    throw new Error(`custom preset extends unknown preset "${custom.extends}"`);
  }
  const { extends: _extends, ...own } = custom;
  return { ...base, ...own };
}

/**
 * Per-agent model pins from config `modelOverrides`. Every key must name a
 * configured agent and every value must be a non-empty model id string.
 * Overrides win over any preset when applied (see applyModelOverrides).
 */
export function validateModelOverrides(config) {
  const overrides = config.modelOverrides;
  if (overrides === undefined) return {};
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    throw new Error("modelOverrides must be an object");
  }
  const names = new Set((config.agents ?? []).map((a) => a?.name));
  const unknown = Object.keys(overrides).filter((k) => !names.has(k));
  if (unknown.length > 0) throw new Error(`modelOverrides reference unknown agent(s): ${unknown.join(", ")}`);
  const invalid = Object.entries(overrides).filter(([, v]) => typeof v !== "string" || v.length === 0);
  if (invalid.length > 0) {
    throw new Error(`modelOverrides contain missing/empty/non-string model id(s): ${invalid.map(([k]) => k).join(", ")}`);
  }
  return overrides;
}

export function applyModelOverrides(agent, overrides = {}) {
  const pinned = overrides?.[agent.name];
  if (pinned === undefined) return agent;
  return { ...agent, model: pinned };
}

export function applyPreset(agent, preset) {
  const merged = { ...agent };
  if (preset.tier !== undefined) {
    if (!isTier(preset.tier)) throw new Error(`Preset tier must be one of ${TIERS.join("|")}`);
    merged.tier = preset.tier;
  }
  if (preset.model !== undefined) merged.model = preset.model;
  if (preset.temperature !== undefined) merged.temperature = preset.temperature;
  if (preset.maxTokens !== undefined) merged.maxTokens = preset.maxTokens;
  if (!merged.model && merged.tier) merged.model = modelForTier(merged.tier);
  return merged;
}

export function validateAgent(agent, index) {
  const where = `agents[${index}]`;
  if (!agent || typeof agent !== "object") throw new Error(`${where} must be an object`);
  if (typeof agent.name !== "string" || agent.name.length === 0) throw new Error(`${where}.name must be a non-empty string`);
  if (typeof agent.systemPrompt !== "string" || agent.systemPrompt.length === 0) throw new Error(`${where}.systemPrompt must be a non-empty string`);
  if (agent.tier !== undefined && !isTier(agent.tier)) throw new Error(`${where}.tier must be one of ${TIERS.join("|")}`);
  if (agent.tools !== undefined && !Array.isArray(agent.tools)) throw new Error(`${where}.tools must be an array`);
  if (agent.maxTokens !== undefined && (!Number.isInteger(agent.maxTokens) || agent.maxTokens <= 0)) {
    throw new Error(`${where}.maxTokens must be a positive integer`);
  }
  if (agent.temperature !== undefined && (typeof agent.temperature !== "number" || agent.temperature < 0 || agent.temperature > 2)) {
    throw new Error(`${where}.temperature must be a number in [0, 2]`);
  }
}

export function validateConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Config root must be an object");
  const tier = config.defaultTier ?? "balanced";
  if (!isTier(tier)) throw new Error(`defaultTier must be one of ${TIERS.join("|")}`);
  const agents = config.agents ?? [];
  if (!Array.isArray(agents)) throw new Error("agents must be an array");
  agents.forEach(validateAgent);
  const notify = config.notify;
  if (notify !== undefined) {
    if (!notify || typeof notify !== "object") throw new Error("notify must be an object");
    for (const [name, hook] of Object.entries(notify)) validateNotifyHook(name, hook);
  }
  if (config.allowExternalNotificationFile !== undefined && typeof config.allowExternalNotificationFile !== "boolean") {
    throw new Error("allowExternalNotificationFile must be a boolean");
  }
  validateModelOverrides(config);
  return { defaultTier: tier, agents };
}

export function loadProjectConfig(targetDir) {
  const file = path.join(installDirFor(targetDir), CONFIG_FILENAME);
  if (!fs.existsSync(file)) {
    const legacy = path.join(path.resolve(targetDir), CONFIG_FILENAME);
    if (fs.existsSync(legacy)) return { config: expandEnv(validateConfigRaw(loadJsoncFile(legacy))), file: legacy };
    return { config: null, file };
  }
  return { config: expandEnv(validateConfigRaw(loadJsoncFile(file))), file };
}

function validateConfigRaw(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Config root must be an object");
  return raw;
}

export function listManagedFiles(manifest) {
  return [...(manifest.files ?? [])].sort();
}

export function readManifest(targetDir) {
  const file = path.join(installDirFor(targetDir), MANAGED_FILENAME);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function collectPackFiles(repoRoot) {
  const roots = [path.join(repoRoot, "pack"), path.join(repoRoot, "types")].filter((d) => fs.existsSync(d));
  const files = [];
  for (const root of roots) {
    const stack = [root];
    while (stack.length > 0) {
      const cur = stack.pop();
      for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
        const full = path.join(cur, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (entry.isFile()) files.push(path.relative(repoRoot, full));
      }
    }
  }
  return files.sort();
}

export function stageAndCommit(stagingDir, destDir, operations) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });
  try {
    for (const op of operations) op(stagingDir);
    fs.mkdirSync(path.dirname(destDir), { recursive: true });
    const backupDir = `${destDir}.backup.${process.pid}`;
    const hadDest = fs.existsSync(destDir);
    if (hadDest) fs.renameSync(destDir, backupDir);
    try {
      fs.renameSync(stagingDir, destDir);
    } catch (err) {
      if (hadDest && !fs.existsSync(destDir) && fs.existsSync(backupDir)) fs.renameSync(backupDir, destDir);
      throw err;
    }
    if (hadDest) fs.rmSync(backupDir, { recursive: true, force: true });
  } catch (err) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw err;
  }
}

function copyRelative(repoRoot, stagingDir, rel) {
  const src = path.join(repoRoot, rel);
  const dest = path.join(stagingDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

export function installPack({ repoRoot, targetDir, overwrite = true }) {
  const dest = installDirFor(targetDir);
  const relFiles = collectPackFiles(repoRoot);
  if (relFiles.length === 0) throw new Error(`No pack files found under ${repoRoot}`);
  const staging = `${dest}.staging.${process.pid}`;
  stageAndCommit(staging, dest, [
    (stage) => {
      for (const rel of relFiles) {
        const destFile = path.join(dest, rel);
        if (!overwrite && fs.existsSync(destFile)) {
          copyRelative(repoRoot, stage, rel);
          continue;
        }
        copyRelative(repoRoot, stage, rel);
      }
      if (overwrite || !fs.existsSync(path.join(dest, CONFIG_FILENAME))) {
        const template = path.join(repoRoot, CONFIG_FILENAME);
        const cfgText = fs.existsSync(template)
          ? fs.readFileSync(template, "utf8")
          : `{\n  "defaultTier": "balanced",\n  "agents": []\n}\n`;
        fs.writeFileSync(path.join(stage, CONFIG_FILENAME), cfgText);
      } else {
        fs.writeFileSync(path.join(stage, CONFIG_FILENAME), fs.readFileSync(path.join(dest, CONFIG_FILENAME), "utf8"));
      }
    },
  ]);
  const manifest = {
    version: 1,
    repoRoot: path.resolve(repoRoot),
    installedAt: new Date().toISOString(),
    files: [...relFiles, CONFIG_FILENAME].sort(),
  };
  fs.writeFileSync(path.join(dest, MANAGED_FILENAME), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileMode(path.join(dest, CONFIG_FILENAME), fs.readFileSync(path.join(dest, CONFIG_FILENAME), "utf8"), CONFIG_MODE);
  return { dest, files: manifest.files };
}

export function updatePack({ repoRoot, targetDir }) {
  const dest = installDirFor(targetDir);
  if (!fs.existsSync(dest)) throw new Error(`Nothing installed at ${dest}; run install first`);
  const prevManifest = readManifest(targetDir);
  const prevFiles = new Set(prevManifest?.files ?? []);
  const relFiles = collectPackFiles(repoRoot);
  const staging = `${dest}.staging.${process.pid}`;
  const nextFiles = [...relFiles, CONFIG_FILENAME].sort();
  stageAndCommit(staging, dest, [
    (stage) => {
      for (const rel of relFiles) copyRelative(repoRoot, stage, rel);
      const prevConfig = path.join(dest, CONFIG_FILENAME);
      const template = path.join(repoRoot, CONFIG_FILENAME);
      if (fs.existsSync(prevConfig)) {
        fs.writeFileSync(path.join(stage, CONFIG_FILENAME), fs.readFileSync(prevConfig, "utf8"));
      } else if (fs.existsSync(template)) {
        fs.writeFileSync(path.join(stage, CONFIG_FILENAME), fs.readFileSync(template, "utf8"));
      }
    },
  ]);
  for (const old of prevFiles) {
    if (!nextFiles.includes(old) && old !== MANAGED_FILENAME) {
      const p = path.join(dest, old);
      if (fs.existsSync(p)) fs.rmSync(p, { force: true });
    }
  }
  const manifest = {
    version: 1,
    repoRoot: path.resolve(repoRoot),
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    files: nextFiles,
  };
  fs.writeFileSync(path.join(dest, MANAGED_FILENAME), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileMode(path.join(dest, CONFIG_FILENAME), fs.readFileSync(path.join(dest, CONFIG_FILENAME), "utf8"), CONFIG_MODE);
  return { dest, files: nextFiles };
}

export function uninstallPack({ targetDir }) {
  const dest = installDirFor(targetDir);
  const manifest = readManifest(targetDir);
  if (!manifest) {
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    return { dest, removed: [] };
  }
  const removed = [];
  for (const rel of listManagedFiles(manifest)) {
    const p = path.join(dest, rel);
    if (fs.existsSync(p)) {
      fs.rmSync(p, { force: true });
      removed.push(rel);
    }
  }
  const managedFile = path.join(dest, MANAGED_FILENAME);
  if (fs.existsSync(managedFile)) fs.rmSync(managedFile, { force: true });
  pruneEmptyDirs(dest);
  if (fs.existsSync(dest) && fs.readdirSync(dest).length === 0) fs.rmdirSync(dest);
  const parent = path.dirname(dest);
  if (fs.existsSync(parent) && fs.readdirSync(parent).length === 0) fs.rmdirSync(parent);
  return { dest, removed };
}

function pruneEmptyDirs(root) {
  if (!fs.existsSync(root)) return;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(root, entry.name);
    pruneEmptyDirs(full);
    if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
  }
}

export function doctor({ repoRoot, targetDir }) {
  const checks = [];
  const push = (ok, message) => checks.push({ ok: Boolean(ok), message });
  const major = Number(process.versions.node.split(".")[0]);
  push(major >= 20, `node >= 20 (found ${process.version})`);
  push(fs.existsSync(path.join(repoRoot, "models.json")), `models.json present in ${repoRoot}`);
  push(fs.existsSync(path.join(repoRoot, "pack")), `pack/ present in ${repoRoot}`);
  const { config, file } = loadProjectConfig(targetDir);
  push(config !== null, config ? `config loads (${file})` : `config found (${file})`);
  if (config) {
    try {
      validateConfig(config);
      push(true, "config validation passes");
    } catch (err) {
      push(false, `config invalid: ${err.message}`);
    }
    const mode = fs.existsSync(file) ? fs.statSync(file).mode & 0o777 : null;
    if (configHasSecrets(config)) {
      push(mode === CONFIG_MODE, mode === null ? "config permissions unknown" : `config holds secrets and mode is 0600 (found ${mode.toString(8)})`);
    } else {
      push(true, mode === null ? "config holds no secrets (0600 not required)" : `config holds no secrets (mode ${mode.toString(8)}, 0600 not required)`);
    }
  }
  const manifest = readManifest(targetDir);
  if (manifest) {
    push(true, "managed manifest present");
  } else if (!fs.existsSync(installDirFor(targetDir))) {
    push(true, "pack not installed here (source checkout; run omm install --dir <project>)");
  } else {
    push(false, "install dir exists without a manifest (partial install? reinstall)");
  }
  if (config?.notify) {
    for (const [name, hook] of Object.entries(config.notify)) {
      try {
        validateNotifyHook(name, hook);
        push(true, `notify.${name} webhook uses https or is unset`);
      } catch (err) {
        push(false, `notify.${name}: ${err.message}`);
      }
    }
  }
  if (config?.agents) {
    const bad = config.agents.filter((a) => a.tier && !isTier(a.tier));
    push(bad.length === 0, bad.length === 0 ? "agent tiers are budget|balanced|premium" : `invalid tiers: ${bad.map((a) => a.name).join(", ")}`);
  }
  if (config && file) push(...gitignoreWarning(targetDir, file, configHasSecrets(config)));
  return checks;
}

function gitTopLevel(dir) {
  try {
    return execFileSync("git", ["-C", path.resolve(dir), "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function gitignoreWarning(targetDir, configFile, hasSecrets) {
  const top = gitTopLevel(targetDir);
  if (!top) return [true, "not a git checkout (gitignore check skipped)"];
  let ignored = false;
  try {
    execFileSync("git", ["-C", top, "check-ignore", "-q", path.resolve(configFile)], { stdio: "ignore" });
    ignored = true;
  } catch {
    ignored = false;
  }
  if (hasSecrets && !ignored) {
    return [false, `warning: ${configFile} holds secrets but is not gitignored`];
  }
  return [true, ignored ? "secret-bearing config is gitignored" : "config gitignore state ok"];
}

export function homeConfigPath() {
  return path.join(os.homedir(), INSTALL_DIRNAME, CONFIG_FILENAME);
}

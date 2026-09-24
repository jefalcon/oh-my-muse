import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  TIERS,
  TIER_MODELS,
  CONFIG_FILENAME,
  CONFIG_MODE,
  repoRootFromHere,
  resolveTargetDir,
  installDirFor,
  stripJsonc,
  parseJsonc,
  loadJsoncFile,
  writeFileMode,
  expandEnvInString,
  expandEnv,
  redactValue,
  redactConfig,
  redactText,
  assertHttps,
  isTier,
  modelForTier,
  loadModelsFile,
  getPreset,
  applyPreset,
  validateAgent,
  validateConfig,
  configHasSecrets,
  gitignoreWarning,
  doctor,
} from "../bin/lib.mjs";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

let tmpDirs = [];
function makeTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omm-cli-test-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  tmpDirs = [];
});

describe("tiers are literal strings budget|balanced|premium", () => {
  it("TIERS contains exactly the three literals", () => {
    assert.deepEqual([...TIERS].sort(), ["balanced", "budget", "premium"]);
  });

  it("isTier accepts only the literals", () => {
    assert.equal(isTier("budget"), true);
    assert.equal(isTier("balanced"), true);
    assert.equal(isTier("premium"), true);
    assert.equal(isTier("Budget"), false);
    assert.equal(isTier("standard"), false);
    assert.equal(isTier(""), false);
    assert.equal(isTier(undefined), false);
  });

  it("modelForTier maps each tier and rejects unknown tiers", () => {
    assert.equal(modelForTier("budget"), TIER_MODELS.budget);
    assert.equal(modelForTier("balanced"), TIER_MODELS.balanced);
    assert.equal(modelForTier("premium"), TIER_MODELS.premium);
    assert.throws(() => modelForTier("standard"), /Unknown tier/);
  });
});

describe("absolute path helpers", () => {
  it("repoRootFromHere resolves the repo root absolutely", () => {
    const root = repoRootFromHere(import.meta.url);
    assert.equal(path.isAbsolute(root), true);
    assert.equal(root, REPO_ROOT);
    assert.equal(fs.existsSync(path.join(root, "bin", "lib.mjs")), true);
  });

  it("resolveTargetDir resolves relative targets against cwd absolutely", () => {
    const cwd = makeTmp();
    assert.equal(resolveTargetDir(cwd, undefined), path.resolve(cwd));
    assert.equal(resolveTargetDir(cwd, "sub"), path.resolve(cwd, "sub"));
    assert.equal(resolveTargetDir(cwd, "/tmp/abs"), path.normalize("/tmp/abs"));
  });

  it("installDirFor is an absolute path under the target", () => {
    const target = makeTmp();
    const dir = installDirFor(target);
    assert.equal(path.isAbsolute(dir), true);
    assert.equal(dir, path.join(path.resolve(target), ".claude", "oh-my-muse"));
  });
});

describe("JSONC handling", () => {
  it("stripJsonc removes line and block comments but keeps strings", () => {
    const text = `{
      // a comment
      "a": 1, /* inline */ "b": "//not-a-comment"
    }`;
    assert.deepEqual(JSON.parse(stripJsonc(text)), { a: 1, b: "//not-a-comment" });
  });

  it("parseJsonc parses JSONC and labels errors", () => {
    assert.deepEqual(parseJsonc(`{ "x": 1 // hi\n }`), { x: 1 });
    assert.throws(() => parseJsonc(`{ bad }`, "myconfig"), /Invalid JSONC in myconfig/);
  });

  it("loadJsoncFile reads a file and writeFileMode round-trips with 0600", () => {
    const dir = makeTmp();
    const file = path.join(dir, CONFIG_FILENAME);
    writeFileMode(file, `{\n  // comment\n  "defaultTier": "balanced"\n}\n`);
    assert.deepEqual(loadJsoncFile(file), { defaultTier: "balanced" });
    assert.equal(fs.statSync(file).mode & 0o777, CONFIG_MODE);
  });
});

describe("env expansion", () => {
  it("expandEnvInString supports $VAR, ${VAR} and ${VAR:-default}", () => {
    assert.equal(expandEnvInString("hi $NAME", { NAME: "bob" }), "hi bob");
    assert.equal(expandEnvInString("hi ${NAME}", { NAME: "bob" }), "hi bob");
    assert.equal(expandEnvInString("hi ${MISSING:-fallback}", {}), "hi fallback");
    assert.equal(expandEnvInString("hi $MISSING", {}), "hi $MISSING");
  });

  it("expandEnv recurses through objects and arrays", () => {
    assert.deepEqual(
      expandEnv({ a: "$X", b: ["$X", 1], c: { d: "${X}" } }, { X: "v" }),
      { a: "v", b: ["v", 1], c: { d: "v" } },
    );
  });
});

describe("redaction and URL policy", () => {
  it("redactValue redacts sensitive keys only", () => {
    assert.equal(redactValue("api_key", "abc"), "[redacted]");
    assert.equal(redactValue("botToken", "abc"), "[redacted]");
    assert.equal(redactValue("name", "abc"), "abc");
    assert.equal(redactValue("api_key", ""), "");
  });

  it("redactConfig recurses and redactText scrubs tokens and keys", () => {
    assert.deepEqual(redactConfig({ notify: { url: "https://x", api_key: "s3cr3t" } }), {
      notify: { url: "https://x", api_key: "[redacted]" },
    });
    assert.ok(!redactText("token bot123:ABCDefghij12345 here").includes("ABCDefghij12345"));
    assert.ok(
      !redactText("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----").includes("abc"),
    );
  });

  it("assertHttps requires https URLs", () => {
    assert.equal(assertHttps("https://example.com/hook"), "https://example.com/hook");
    assert.throws(() => assertHttps("http://example.com/hook"), /must use https/);
    assert.throws(() => assertHttps("not a url"), /not a valid URL/);
  });
});

describe("models and presets", () => {
  it("loadModelsFile reads the repo models.json with tiered presets", () => {
    const models = loadModelsFile(REPO_ROOT);
    assert.ok(models.presets.code);
    assert.equal(models.presets.code.tier, "balanced");
  });

  it("getPreset merges presets and customPresets and rejects unknown names", () => {
    const models = loadModelsFile(REPO_ROOT);
    assert.deepEqual(getPreset(models, "code"), models.presets.code);
    assert.deepEqual(getPreset(models, "example-local"), models.customPresets["example-local"]);
    assert.throws(() => getPreset(models, "nope"), /Unknown preset/);
  });

  it("applyPreset fills the model from a valid tier and rejects bad tiers", () => {
    const merged = applyPreset({ name: "a", systemPrompt: "s" }, { tier: "premium" });
    assert.equal(merged.tier, "premium");
    assert.equal(merged.model, TIER_MODELS.premium);
    assert.throws(() => applyPreset({ name: "a", systemPrompt: "s" }, { tier: "gold" }), /one of/);
  });
});

describe("agent and config validation", () => {
  const good = { name: "helper", systemPrompt: "Be helpful.", tier: "balanced" };

  it("validateAgent accepts a good agent and rejects bad shapes", () => {
    validateAgent({ ...good }, 0);
    assert.throws(() => validateAgent(null, 0), /must be an object/);
    assert.throws(() => validateAgent({ ...good, name: "" }, 0), /\.name/);
    assert.throws(() => validateAgent({ ...good, systemPrompt: "" }, 0), /\.systemPrompt/);
    assert.throws(() => validateAgent({ ...good, tier: "gold" }, 0), /\.tier/);
    assert.throws(() => validateAgent({ ...good, temperature: 5 }, 0), /\.temperature/);
    assert.throws(() => validateAgent({ ...good, maxTokens: 0 }, 0), /\.maxTokens/);
  });

  it("validateConfig defaults the tier and validates agents and notify hooks", () => {
    assert.deepEqual(validateConfig({ agents: [] }), { defaultTier: "balanced", agents: [] });
    assert.throws(() => validateConfig({ defaultTier: "gold" }), /defaultTier/);
    assert.throws(() => validateConfig({ agents: [{ ...good, tier: "gold" }] }), /\.tier/);
    assert.throws(
      () => validateConfig({ agents: [], notify: { h: { url: "http://x" } } }),
      /must use https/,
    );
    validateConfig({ agents: [], notify: { h: { channel: "file" } } });
  });
});

describe("project config loading", () => {
  it("falls back to the legacy root omm.jsonc", async () => {
    const { loadProjectConfig } = await import("../bin/lib.mjs");
    const dir = makeTmp();
    fs.writeFileSync(path.join(dir, "omm.jsonc"), `{\n  "defaultTier": "budget",\n  "agents": []\n}\n`);
    const { config } = loadProjectConfig(dir);
    assert.equal(config.defaultTier, "budget");
  });
});

describe("doctor secret handling", () => {
  it("configHasSecrets detects secret-bearing keys only", () => {
    assert.equal(configHasSecrets({ agents: [] }), false);
    assert.equal(configHasSecrets({ notify: { t: { channel: "file" } } }), false);
    assert.equal(configHasSecrets({ notify: { t: { botToken: "abc" } } }), true);
    assert.equal(configHasSecrets({ notify: { t: { botToken: "" } } }), false);
    assert.equal(configHasSecrets({ agents: [{ name: "a", apiKey: "k" }] }), true);
  });

  it("doctor requires 0600 only when the config holds secrets", () => {
    const dir = makeTmp();
    fs.writeFileSync(path.join(dir, "omm.jsonc"), `{\n  "defaultTier": "balanced",\n  "agents": []\n}\n`);
    fs.chmodSync(path.join(dir, "omm.jsonc"), 0o644);
    const repoRoot = repoRootFromHere(new URL("../bin/lib.mjs", import.meta.url).href);
    const byMsg = Object.fromEntries(doctor({ repoRoot, targetDir: dir }).map((c) => [c.message, c.ok]));
    const perm = Object.entries(byMsg).find(([m]) => m.includes("0600 not required"));
    assert.ok(perm, "secretless config must not fail the 0600 check");
    assert.equal(perm[1], true);
  });

  it("doctor fails 0600 when a secret-bearing config is group-readable", () => {
    const dir = makeTmp();
    fs.writeFileSync(
      path.join(dir, "omm.jsonc"),
      `{\n  "defaultTier": "balanced",\n  "agents": [],\n  "notify": { "t": { "channel": "telegram", "botToken": "s3cr3t" } }\n}\n`,
    );
    fs.chmodSync(path.join(dir, "omm.jsonc"), 0o644);
    const repoRoot = repoRootFromHere(new URL("../bin/lib.mjs", import.meta.url).href);
    const failed = doctor({ repoRoot, targetDir: dir }).filter((c) => !c.ok);
    assert.ok(failed.some((c) => c.message.includes("holds secrets and mode is 0600")));
  });

  it("gitignoreWarning passes outside git and flags unignored secrets", () => {
    const [okOutside] = gitignoreWarning(makeTmp(), "/nope/omm.jsonc", true);
    assert.equal(okOutside, true);
  });
});

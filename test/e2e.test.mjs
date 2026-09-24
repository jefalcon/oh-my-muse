import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  CONFIG_MODE,
  installDirFor,
  loadJsoncFile,
  loadProjectConfig,
  installPack,
  updatePack,
  uninstallPack,
  doctor,
  collectPackFiles,
} from "../bin/lib.mjs";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OMM_CLI = path.join(REPO_ROOT, "bin", "omm.mjs");

function runCli(args, cwd) {
  return execFileSync("node", [OMM_CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, OMM_DIR: undefined },
  });
}

let tmpDirs = [];
function makeTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omm-e2e-"));
  tmpDirs.push(dir);
  return dir;
}
beforeEach(() => {
  tmpDirs = [];
});
afterEach(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  tmpDirs = [];
});

describe("pack install/update/uninstall round-trip (absolute tmp dirs)", () => {
  it("installs pack files, preserves config on update, removes on uninstall", () => {
    const target = makeTmp();
    assert.equal(path.isAbsolute(target), true);

    const relFiles = collectPackFiles(REPO_ROOT);
    assert.ok(relFiles.length > 0, "repo must ship pack files");

    const installed = installPack({ repoRoot: REPO_ROOT, targetDir: target });
    const dest = installDirFor(target);
    assert.equal(installed.dest, dest);
    assert.ok(fs.existsSync(path.join(dest, "omm.jsonc")));
    assert.equal(fs.statSync(path.join(dest, "omm.jsonc")).mode & 0o777, CONFIG_MODE);
    assert.ok(fs.existsSync(path.join(dest, "omm-managed.json")));
    assert.ok(fs.existsSync(path.join(dest, "pack", "agents", "planner.ts")));

    const { config } = loadProjectConfig(target);
    assert.ok(config, "installed config must load");

    const checks = doctor({ repoRoot: REPO_ROOT, targetDir: target });
    const failed = checks.filter((c) => !c.ok);
    assert.deepEqual(failed, [], `doctor must pass, got: ${JSON.stringify(failed)}`);

    const updated = updatePack({ repoRoot: REPO_ROOT, targetDir: target });
    assert.ok(updated.files.includes("omm.jsonc"));

    const removed = uninstallPack({ targetDir: target });
    assert.ok(removed.removed.length > 0);
    assert.equal(fs.existsSync(path.join(dest, "omm-managed.json")), false);
  });

  it("update without install throws", () => {
    assert.throws(() => updatePack({ repoRoot: REPO_ROOT, targetDir: makeTmp() }), /run install first/);
  });
});

describe("omm CLI end to end", () => {
  it("setup -> install -> list -> doctor -> update -> uninstall", () => {
    const target = makeTmp();

    runCli(["setup", "--dir", target], REPO_ROOT);
    const setupFile = path.join(installDirFor(target), "omm.jsonc");
    assert.equal(fs.existsSync(setupFile), true);
    assert.equal(fs.statSync(setupFile).mode & 0o777, CONFIG_MODE);

    const installOut = runCli(["install", "--dir", target], REPO_ROOT);
    assert.match(installOut, /Installed \d+ files/);

    const listOut = runCli(["list", "--dir", target], REPO_ROOT);
    assert.match(listOut, /code-helper|No agents configured/);

    const listJson = runCli(["list", "--dir", target, "--json"], REPO_ROOT);
    assert.ok(Array.isArray(JSON.parse(listJson)));

    runCli(["doctor", "--dir", target], REPO_ROOT);

    const updateOut = runCli(["update", "--dir", target], REPO_ROOT);
    assert.match(updateOut, /Updated \d+ files/);

    const uninstallOut = runCli(["uninstall", "--dir", target], REPO_ROOT);
    assert.match(uninstallOut, /Removed|Nothing tracked/);
  });

  it("preset show and config get/set round-trip", () => {
    const target = makeTmp();
    runCli(["setup", "--dir", target], REPO_ROOT);

    const presetOut = runCli(["preset", "code", "--dir", target], REPO_ROOT);
    const preset = JSON.parse(presetOut);
    assert.equal(preset.tier, "balanced");

    runCli(["config", "set", "defaultTier", "premium", "--dir", target], REPO_ROOT);
    const getOut = runCli(["config", "get", "defaultTier", "--dir", target], REPO_ROOT);
    assert.equal(JSON.parse(getOut), "premium");
  });

  it("config set rejects invalid tiers", () => {
    const target = makeTmp();
    runCli(["setup", "--dir", target], REPO_ROOT);
    assert.throws(() => runCli(["config", "set", "defaultTier", "gold", "--dir", target], REPO_ROOT));
  });

  it("notify file channel appends to an absolute file", () => {
    const target = makeTmp();
    const logFile = path.join(target, "notify.log");
    const out = runCli(
      ["notify", "--channel", "file", "--message", "hello e2e", "--file", logFile, "--dir", target],
      REPO_ROOT,
    );
    assert.match(out, /Notified via file/);
    assert.match(fs.readFileSync(logFile, "utf8"), /hello e2e/);
  });

  it("skill list shows installed skills", () => {
    const target = makeTmp();
    runCli(["install", "--dir", target], REPO_ROOT);
    const out = runCli(["skill", "list", "--dir", target], REPO_ROOT);
    assert.match(out, /verify|tdd|security/);
  });

  it("config-driven notify file outside the project is refused without opt-in", () => {
    const target = makeTmp();
    runCli(["setup", "--dir", target], REPO_ROOT);
    const outside = path.join(makeTmp(), "outside.log");
    runCli(["config", "set", "notify.ext.channel", "file", "--dir", target], REPO_ROOT);
    runCli(["config", "set", "notify.ext.file", outside, "--dir", target], REPO_ROOT);
    assert.throws(
      () => runCli(["notify", "--channel", "file", "--message", "nope", "--hook", "ext", "--dir", target], REPO_ROOT),
      /outside project root/,
    );
    assert.equal(fs.existsSync(outside), false);
    runCli(["config", "set", "allowExternalNotificationFile", "true", "--dir", target], REPO_ROOT);
    const out = runCli(["notify", "--channel", "file", "--message", "opted in", "--hook", "ext", "--dir", target], REPO_ROOT);
    assert.match(out, /Notified via file/);
    assert.match(fs.readFileSync(outside, "utf8"), /opted in/);
  });

  it("modelOverrides pin survives preset application", () => {
    const target = makeTmp();
    runCli(["setup", "--dir", target], REPO_ROOT);
    const cfgFile = path.join(installDirFor(target), "omm.jsonc");
    const cfg = loadJsoncFile(cfgFile);
    cfg.agents = [{ name: "pinned", systemPrompt: "s", tier: "budget" }];
    cfg.modelOverrides = { pinned: "custom-model-1" };
    fs.writeFileSync(cfgFile, `${JSON.stringify(cfg, null, 2)}\n`);
    const listOut = runCli(["list", "--dir", target, "--json"], REPO_ROOT);
    const agents = JSON.parse(listOut);
    assert.equal(agents.find((a) => a.name === "pinned").model, "custom-model-1");
    runCli(["preset", "code", "--apply", "pinned", "--dir", target], REPO_ROOT);
    const listOut2 = runCli(["list", "--dir", target, "--json"], REPO_ROOT);
    assert.equal(JSON.parse(listOut2).find((a) => a.name === "pinned").model, "custom-model-1");
  });
});

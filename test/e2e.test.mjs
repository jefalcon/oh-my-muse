import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OMM_CLI = path.join(REPO_ROOT, "bin", "omm.mjs");
const PLUGIN_DIR = path.join(REPO_ROOT, "plugin");

const museAvailable = (() => {
  try {
    execFileSync("muse", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

function runCli(args, cwd, extraEnv = {}) {
  return execFileSync("node", [OMM_CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
}

function runCliFail(args, cwd, extraEnv = {}) {
  try {
    runCli(args, cwd, extraEnv);
  } catch (err) {
    return { status: err.status ?? 1, output: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
  assert.fail(`expected omm ${args.join(" ")} to fail`);
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

/** PATH with node but without muse, for no-muse error paths. */
function pathWithoutMuse() {
  return path.dirname(process.execPath);
}

describe("CLI surface", () => {
  it("help lists the five commands", () => {
    const out = runCli(["help"], makeTmp());
    for (const cmd of ["install", "uninstall", "validate", "doctor", "notify"]) {
      assert.ok(out.includes(cmd), `help must mention ${cmd}`);
    }
  });

  it("unknown command fails with a clear error", () => {
    const res = runCliFail(["frobnicate"], makeTmp());
    assert.notEqual(res.status, 0);
    assert.ok(res.output.includes("Unknown command"), res.output);
  });

  it("notify sends to the file channel in the cwd", () => {
    const cwd = makeTmp();
    const out = runCli(["notify", "--channel", "file", "--message", "deploy done", "--file", "n.log"], cwd);
    assert.ok(out.includes("Notified via file"), out);
    assert.match(fs.readFileSync(path.join(cwd, "n.log"), "utf8"), /deploy done/);
  });

  it("notify requires a message", () => {
    const res = runCliFail(["notify", "--channel", "file"], makeTmp());
    assert.notEqual(res.status, 0);
    assert.ok(res.output.includes("--message"), res.output);
  });

  it("notify rejects an http webhook without leaking it", () => {
    const res = runCliFail(
      ["notify", "--channel", "discord", "--message", "hi", "--webhookUrl", "http://evil.example/x"],
      makeTmp(),
    );
    assert.notEqual(res.status, 0);
    assert.ok(!res.output.includes("http://evil.example/x"), "URL must not leak");
  });
});

describe("install/uninstall via a fake muse shim", () => {
  function makeShim() {
    const dir = makeTmp();
    const log = path.join(dir, "calls.log");
    const shim = path.join(dir, "muse");
    fs.writeFileSync(shim, `#!/bin/sh\necho "$@" >> ${JSON.stringify(log)}\necho "shim-ok"\n`);
    fs.chmodSync(shim, 0o755);
    const calls = () => fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : [];
    return { dir, calls };
  }

  it("install calls plugins install with the package plugin dir and prints (not runs) approve", () => {
    const { dir, calls } = makeShim();
    const out = runCli(["install", "--scope", "user"], makeTmp(), { PATH: `${dir}${path.delimiter}${process.env.PATH}` });
    assert.deepEqual(calls(), [`plugins install ${PLUGIN_DIR} --scope user`]);
    assert.ok(out.includes("muse plugins approve oh-my-muse"), "must print the pending approve step");
  });

  it("install rejects a bad scope without calling muse", () => {
    const { dir, calls } = makeShim();
    const res = runCliFail(["install", "--scope", "global"], makeTmp(), { PATH: `${dir}${path.delimiter}${process.env.PATH}` });
    assert.ok(res.output.includes("--scope must be user|project"), res.output);
    assert.deepEqual(calls(), [], "muse must not be called on bad scope");
  });

  it("uninstall calls plugins remove", () => {
    const { dir, calls } = makeShim();
    runCli(["uninstall"], makeTmp(), { PATH: `${dir}${path.delimiter}${process.env.PATH}` });
    assert.deepEqual(calls(), ["plugins remove oh-my-muse"]);
  });
});

describe("no-muse error paths", () => {
  it("install without muse fails with a clear error", () => {
    const res = runCliFail(["install"], makeTmp(), { PATH: pathWithoutMuse() });
    assert.notEqual(res.status, 0);
    assert.ok(res.output.includes("muse CLI not found in PATH"), res.output);
  });

  it("validate without muse fails with a clear error", () => {
    const res = runCliFail(["validate"], makeTmp(), { PATH: pathWithoutMuse() });
    assert.notEqual(res.status, 0);
    assert.ok(res.output.includes("muse CLI not found in PATH"), res.output);
  });

  it("doctor without muse reports the missing binary and fails", () => {
    const res = runCliFail(["doctor"], makeTmp(), { PATH: pathWithoutMuse() });
    assert.notEqual(res.status, 0);
    assert.ok(res.output.includes("muse in PATH"), res.output);
  });
});

describe("real muse round-trips", { skip: !museAvailable ? "muse CLI not in PATH" : false }, () => {
  it("validate passes on the shipped plugin", () => {
    const out = runCli(["validate"], makeTmp());
    assert.ok(out.includes("ok   plugin"), out);
  });

  it("doctor passes on this checkout", () => {
    const out = runCli(["doctor"], REPO_ROOT);
    assert.ok(out.includes("validators pass"), out);
  });
});

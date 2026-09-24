import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OMM_CLI = path.join(REPO_ROOT, "bin", "omm.mjs");

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

describe("real validators", { skip: !museAvailable ? "muse CLI not in PATH" : false }, () => {
  it("every plugin skill validates clean (valid:true, no diagnostics)", () => {
    const skillsRoot = path.join(REPO_ROOT, "plugin", "skills");
    const dirs = fs.readdirSync(skillsRoot)
      .filter((n) => fs.statSync(path.join(skillsRoot, n)).isDirectory())
      .sort();
    assert.ok(dirs.length >= 18, `expected 18+ skills, got ${dirs.length}`);
    for (const n of dirs) {
      const out = execFileSync("muse", ["skills", "validate", path.join(skillsRoot, n), "--json"], { encoding: "utf8" });
      const doc = JSON.parse(out);
      assert.equal(doc.valid, true, `${n}: valid must be true`);
      assert.deepEqual(doc.diagnostics ?? [], [], `${n}: diagnostics must be empty`);
    }
  });

  it("the plugin validates clean (valid:true, no diagnostics)", () => {
    const out = execFileSync("muse", ["plugins", "validate", path.join(REPO_ROOT, "plugin"), "--json"], { encoding: "utf8" });
    const doc = JSON.parse(out);
    assert.equal(doc.valid, true, "plugin valid must be true");
    assert.deepEqual(doc.diagnostics ?? [], [], "plugin diagnostics must be empty");
  });
});

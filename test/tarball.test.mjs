import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execSync } from "node:child_process";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

describe("npm tarball content", () => {
  it("plugin/.muse-plugin/plugin.json ships in the tarball", () => {
    // npm prints the dry-run file list as notices on stderr.
    const out = execSync("npm pack --dry-run 2>&1", { cwd: REPO_ROOT, encoding: "utf8" });
    const files = out.split("\n").map((l) => l.trim()).filter(Boolean);
    const has = (suffix) => files.some((f) => f.endsWith(suffix));
    assert.ok(has("plugin/.muse-plugin/plugin.json"), "tarball must contain plugin/.muse-plugin/plugin.json");
    assert.ok(has("plugin/skills/verify/SKILL.md"), "tarball must contain plugin skills");
    assert.ok(has("plugin/commands/omm-team.md"), "tarball must contain plugin commands");
    assert.ok(has("plugin/hooks/notify-stop.mjs"), "tarball must contain plugin hooks");
    assert.ok(has("bin/omm.mjs"), "tarball must contain bin/omm.mjs");
    assert.ok(!files.some((f) => f.includes("pack/agents/")), "tarball must not contain the removed pack/");
  });
});

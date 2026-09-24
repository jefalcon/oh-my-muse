import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// Absolute user home paths must never be versioned: they leak maintainer
// machine layout into a public repo. `~` or `$HOME` are the accepted forms.
// Matches /home/<user> and /Users/<user> only when a username follows.
const HOME_PATH = /\/(home|Users)\/[A-Za-z0-9_][^/\s:"'`\]]*/;

// Only pre-existing test fixtures may be excluded from the scan. At
// introduction no versioned fixture matched HOME_PATH, so this stays empty;
// add a path here only if it is a committed test fixture with a legitimate
// absolute-path sample.
const FIXTURE_EXCEPTIONS = new Set([]);

function trackedFiles() {
  const out = execFileSync("git", ["ls-files"], { cwd: REPO_ROOT, encoding: "utf8" });
  return out.split("\n").map((l) => l.trim()).filter(Boolean);
}

describe("public-repo hygiene", () => {
  it("no versioned file contains an absolute user home path", () => {
    const offenders = [];
    for (const rel of trackedFiles()) {
      if (FIXTURE_EXCEPTIONS.has(rel)) continue;
      const body = fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
      const hit = body.match(HOME_PATH);
      if (hit) offenders.push(`${rel}: ${hit[0]}`);
    }
    assert.deepEqual(offenders, [], `absolute user paths in versioned files:\n${offenders.join("\n")}`);
  });

  it("docs/muse-recon is neither tracked nor present", () => {
    const tracked = trackedFiles().filter((f) => f === "docs/muse-recon" || f.startsWith("docs/muse-recon/"));
    assert.deepEqual(tracked, [], "docs/muse-recon must not be tracked");
    assert.ok(!fs.existsSync(path.join(REPO_ROOT, "docs", "muse-recon")), "docs/muse-recon must not exist");
  });
});

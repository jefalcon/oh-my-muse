import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readManifest, manifestCapabilities } from "../bin/lib.mjs";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PLUGIN_DIR = path.join(REPO_ROOT, "plugin");

// Regression test for the 0.2.1 bug: plugin/skills/omm-narration/SKILL.md
// existed on disk but was missing from capabilities.skills, so Muse never
// loaded it while `omm doctor` still counted the folder. Both directions
// are checked: everything on disk is declared, and every declaration
// points at a real file.
describe("manifest coherence", () => {
  it("every plugin/skills/*/ dir is declared and every skill entry points at an existing SKILL.md", () => {
    const skillsRoot = path.join(PLUGIN_DIR, "skills");
    const dirs = fs.readdirSync(skillsRoot)
      .filter((n) => fs.statSync(path.join(skillsRoot, n)).isDirectory())
      .sort();
    assert.ok(dirs.length > 0, "plugin/skills must not be empty");
    const { skills } = manifestCapabilities(readManifest(PLUGIN_DIR));
    const ids = skills.map((s) => s.id);
    assert.deepEqual([...new Set(ids)].sort(), [...ids].sort(), "skill ids must be unique");
    for (const dir of dirs) {
      assert.ok(ids.includes(dir), `skill dir plugin/skills/${dir}/ is not declared in capabilities.skills`);
    }
    for (const entry of skills) {
      assert.ok(entry.id, "every skill entry must have an id");
      assert.ok(entry.path, `skill ${entry.id} must have a path`);
      const file = path.join(PLUGIN_DIR, entry.path);
      assert.ok(fs.existsSync(file), `skill ${entry.id} points at missing file: ${entry.path}`);
      assert.ok(file.endsWith("SKILL.md"), `skill ${entry.id} must point at a SKILL.md: ${entry.path}`);
    }
  });

  it("every plugin/commands/*.md is declared and every command entry exists", () => {
    const commandsRoot = path.join(PLUGIN_DIR, "commands");
    const files = fs.readdirSync(commandsRoot).filter((n) => n.endsWith(".md")).sort();
    assert.ok(files.length > 0, "plugin/commands must not be empty");
    const { commands } = manifestCapabilities(readManifest(PLUGIN_DIR));
    const ids = commands.map((c) => c.id);
    assert.deepEqual([...new Set(ids)].sort(), [...ids].sort(), "command ids must be unique");
    for (const file of files) {
      const id = file.slice(0, -".md".length);
      assert.ok(ids.includes(id), `command plugin/commands/${file} is not declared in capabilities.commands`);
    }
    for (const entry of commands) {
      assert.ok(entry.id, "every command entry must have an id");
      assert.ok(entry.path, `command ${entry.id} must have a path`);
      assert.ok(
        fs.existsSync(path.join(PLUGIN_DIR, entry.path)),
        `command ${entry.id} points at missing file: ${entry.path}`,
      );
    }
  });

  it("every hook entry points at an existing script and no two hooks share an argv source", () => {
    const { hooks } = manifestCapabilities(readManifest(PLUGIN_DIR));
    assert.ok(hooks.length > 0, "the manifest must declare at least one hook");
    const ids = hooks.map((h) => h.id);
    assert.deepEqual([...new Set(ids)].sort(), [...ids].sort(), "hook ids must be unique");
    const sources = [];
    for (const entry of hooks) {
      assert.ok(entry.id, "every hook entry must have an id");
      assert.ok(entry.event, `hook ${entry.id} must have an event`);
      assert.ok(Array.isArray(entry.command) && entry.command.length >= 2, `hook ${entry.id} must have an argv command`);
      const script = String(entry.command[1]);
      assert.ok(
        fs.existsSync(path.join(PLUGIN_DIR, script)),
        `hook ${entry.id} points at missing script: ${script}`,
      );
      sources.push(script);
    }
    // The validator rejects a shared argv source (duplicate-hook-source):
    // each hook keeps its own file; shared logic lives in a module that
    // no argv references.
    assert.deepEqual([...new Set(sources)].sort(), [...sources].sort(), "no two hooks may share an argv source");
  });
});

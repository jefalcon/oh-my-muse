import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const COMMANDS_DIR = path.join(REPO_ROOT, "plugin", "commands");

const EXPECTED = [
  "omm-team.md",
  "omm-autopilot.md",
  "omm-ultrawork.md",
  "omm-pipeline.md",
  "omm-ultraqa.md",
  "omm-ralph.md",
  "omm-advisor.md",
];

// Static contract for 0.2.1: every orchestrator command must order the
// model to orchestrate for real (Workflow tool, one call per wave) with
// a user-visible progress contract. Markers mirror the command wording.
const MARKERS = [
  "read_skill bundled:workflow-authoring",
  "DEBES",
  "Un Workflow por oleada",
  "Contrato de progreso",
  "Primero llama a read_skill plugin:oh-my-muse:",
  "complete/evidence/unresolved",
  "4096",
  "no está disponible",
];

// Narration contract (0.2.1, part B): every command must load the
// narration skill and forbid chaining two Workflows without the
// wave-end card and the next wave header in between; every child
// schema carries summary/files/decisions.
const NARRATION_MARKERS = [
  "plugin:oh-my-muse:omm-narration",
  "PROHIBIDO encadenar dos llamadas a Workflow",
  "summary",
  "files:string[]",
  "decisions:string[]",
  'w<N>-<rol>',
];

// Wave-header contract (0.2.2): the model writes no text between waves
// and Muse shows only the Workflow name, so every command makes the
// name the wave header. The 0.2.2 guardian paragraph is gone (the
// guardian is opt-in: its Stop blocks never reach the model while a
// workflow runs in the background).
const WAVE_NAME_MARKERS = [
  "## Nombre de cada Workflow (cabecera visible)",
  "`▶ Oleada N/M · <nombre> · <roles>`",
  "PROHIBIDO usar slugs",
];
const BANNED_MARKERS = [
  "REGLA DE CIERRE DE TURNO",
  "## Guardián de narración",
  "guardián (hook Stop)",
];

// Wave names must fit what the TUI shows: header shape, sober icon.
export const WAVE_NAME = /^▶ Oleada \d+\/\d+ · [^·]+ · [a-z-]+(, [a-z-]+)*$/;

// The four narration templates live in exactly one place.
const TEMPLATE_MARKERS = [
  "## 🏮 OMM",
  "▶ Oleada N/M · <nombre> · <roles>",
  "`name`",
  "Oleada N/M completada",
  "**Gate:**",
  "**Siguiente:**",
  "## ✅ Hecho",
  "git diff --stat",
  "table-fit",
];

describe("orchestrator commands orchestrate for real", () => {
  for (const name of EXPECTED) {
    it(`${name} carries the full orchestration contract`, () => {
      const file = path.join(COMMANDS_DIR, name);
      assert.ok(fs.existsSync(file), `${name} must exist`);
      const body = fs.readFileSync(file, "utf8");
      for (const marker of [...MARKERS, ...NARRATION_MARKERS, ...WAVE_NAME_MARKERS]) {
        assert.ok(body.includes(marker), `${name} must contain: ${marker}`);
      }
      for (const banned of BANNED_MARKERS) {
        assert.ok(!body.includes(banned), `${name} must not contain: ${banned}`);
      }
    });
  }

  it("omm-narration holds the four templates and stays non-invocable", () => {
    const file = path.join(REPO_ROOT, "plugin", "skills", "omm-narration", "SKILL.md");
    assert.ok(fs.existsSync(file), "omm-narration SKILL.md must exist");
    const body = fs.readFileSync(file, "utf8");
    assert.ok(body.includes("user-invocable: false"), "omm-narration must not be user-invocable");
    for (const marker of TEMPLATE_MARKERS) {
      assert.ok(body.includes(marker), `omm-narration must contain: ${marker}`);
    }
  });

  it("every example wave name in commands and skill matches the header shape", () => {
    const files = [
      ...EXPECTED.map((n) => path.join(COMMANDS_DIR, n)),
      path.join(REPO_ROOT, "plugin", "skills", "omm-narration", "SKILL.md"),
    ];
    let examples = 0;
    for (const file of files) {
      for (const [, name] of fs.readFileSync(file, "utf8").matchAll(/`(▶ Oleada \d+\/\d+[^`]*)`/g)) {
        examples++;
        assert.match(name, WAVE_NAME, `${path.basename(file)}: ${name}`);
      }
    }
    assert.ok(examples >= EXPECTED.length, "each command carries a concrete example name");
  });

  it("the header regex accepts real names and rejects slugs", () => {
    assert.match("▶ Oleada 1/4 · investigación · researcher", WAVE_NAME);
    assert.match("▶ Oleada 3/5 · revisión · reviewer, implementer", WAVE_NAME);
    assert.doesNotMatch("omm-oleada-2-implementacion", WAVE_NAME);
    assert.doesNotMatch("Oleada 2/4 · build", WAVE_NAME);
  });
});

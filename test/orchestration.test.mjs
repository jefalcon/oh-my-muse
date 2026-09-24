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

describe("orchestrator commands orchestrate for real", () => {
  for (const name of EXPECTED) {
    it(`${name} carries the full orchestration contract`, () => {
      const file = path.join(COMMANDS_DIR, name);
      assert.ok(fs.existsSync(file), `${name} must exist`);
      const body = fs.readFileSync(file, "utf8");
      for (const marker of MARKERS) {
        assert.ok(body.includes(marker), `${name} must contain: ${marker}`);
      }
    });
  }
});

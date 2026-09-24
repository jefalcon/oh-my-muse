import type { OrchestratorDefinition, OrchestratorStepInput } from "../../types/orchestrator.js";

export const spawnableAgents: string[] = [
  "planner",
  "implementer",
  "tester",
  "reviewer",
  "debugger",
];

export function handleSteps(steps: OrchestratorStepInput[]) {
  const next = steps.find((s) => !s.done) ?? steps[0];
  return {
    waves: next
      ? [
          {
            mode: "sequence" as const,
            steps: [next],
            note: "Single-check loop: run only the next unfinished step, verify it, then re-enter the loop.",
          },
        ]
      : [],
    gate: "One step per loop iteration; each iteration ends with a single pass/fail check.",
  };
}

const definition: OrchestratorDefinition = {
  kind: "orchestrator",
  name: "muse-ralph",
  description:
    "Single-check loop orchestrator: one step per iteration with a pass/fail check.",
  tier: "budget",
  model: "muse-spark-fast",
  systemPrompt: [
    "You are muse-ralph, a single-check loop orchestrator.",
    "Pick the next unfinished step and run only that step.",
    "End the iteration with one check: pass (advance) or fail (retry with a fix).",
    "Keep each iteration small and self-contained; never batch multiple steps.",
    "Loop until every step passes its check.",
  ].join("\n"),
  tools: ["read_file", "grep", "bash_readonly"],
  maxTokens: 2048,
  temperature: 0.2,
  spawnableAgents,
  handleSteps,
};

export default definition;

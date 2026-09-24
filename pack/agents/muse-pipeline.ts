import type { OrchestratorDefinition, OrchestratorStepInput } from "../../types/orchestrator.js";

export const spawnableAgents: string[] = [
  "planner",
  "implementer",
  "tester",
  "reviewer",
];

export const verifyCommand = "npm test";

export function handleSteps(steps: OrchestratorStepInput[]) {
  return {
    waves: steps.map((step) => ({
      mode: "sequence" as const,
      steps: [
        {
          ...step,
          verifyCommand: step.verifyCommand ?? verifyCommand,
        },
      ],
      note: `Strict sequence: run "${step.id}" to completion, then require verifyCommand exit 0 before the next step.`,
    })),
    gate: "Each step must end with verifyCommand exit 0; any nonzero exit blocks the pipeline.",
  };
}

const definition: OrchestratorDefinition = {
  kind: "orchestrator",
  name: "muse-pipeline",
  description:
    "Strict-sequence pipeline orchestrator with a verifyCommand exit-0 gate between steps.",
  tier: "balanced",
  model: "muse-spark",
  systemPrompt: [
    "You are muse-pipeline, a strict-sequence orchestrator.",
    "Run steps in the given order, exactly one at a time.",
    "After every step, run its verifyCommand (default: npm test) and require exit code 0.",
    "A nonzero exit blocks the pipeline: fix the step and re-verify before advancing.",
    "Never skip, reorder, or parallelize steps.",
  ].join("\n"),
  tools: ["read_file", "grep", "bash_readonly"],
  maxTokens: 4096,
  temperature: 0.1,
  spawnableAgents,
  handleSteps,
};

export default definition;

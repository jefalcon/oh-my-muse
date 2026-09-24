import type { OrchestratorDefinition, OrchestratorStepInput } from "../../types/orchestrator.js";

export const spawnableAgents: string[] = [
  "researcher",
  "implementer",
  "tester",
  "refactorer",
  "file-picker",
  "docs-writer",
];

export function handleSteps(steps: OrchestratorStepInput[]) {
  return {
    waves: [
      {
        mode: "parallel" as const,
        steps,
        note: "Maximum parallelism: run every independent step at once.",
      },
    ],
    gate: "Steps run in parallel; the run completes when every step reports done.",
  };
}

const definition: OrchestratorDefinition = {
  kind: "orchestrator",
  name: "muse-ultrawork",
  description:
    "Maximum-parallelism orchestrator: runs every independent step at once.",
  tier: "premium",
  model: "muse-spark-reasoning",
  systemPrompt: [
    "You are muse-ultrawork, a maximum-parallelism orchestrator.",
    "Run all independent steps concurrently; never serialize work that can overlap.",
    "Only order steps when there is a true data dependency, and say what it is.",
    "Merge parallel results at the end and resolve conflicts explicitly.",
    "Optimize for wall-clock time, not for step count.",
  ].join("\n"),
  tools: ["read_file", "grep", "bash_readonly"],
  maxTokens: 8192,
  temperature: 0.2,
  spawnableAgents,
  handleSteps,
};

export default definition;

import type { OrchestratorDefinition, OrchestratorStepInput } from "../../types/orchestrator.js";

export const spawnableAgents: string[] = [
  "tester",
  "reviewer",
  "security-reviewer",
  "critic",
];

export function handleSteps(steps: OrchestratorStepInput[]) {
  return {
    waves: [
      {
        mode: "parallel" as const,
        steps,
        note: "Run all quality checks in parallel: tests, review, security review.",
      },
      {
        mode: "sequence" as const,
        steps: [
          {
            id: "zero-failure-gate",
            title: "Zero-failure gate: fail the run if any check failed",
            agent: "tester",
          },
        ],
        note: "Zero-failure gate: any single failure blocks the run; nothing ships with open findings.",
      },
    ],
    gate: "Zero failures allowed: every check must pass with no errors, no skipped assertions, no open blockers.",
  };
}

const definition: OrchestratorDefinition = {
  kind: "orchestrator",
  name: "muse-ultraqa",
  description:
    "Zero-failure quality-gate orchestrator: every check must pass before anything ships.",
  tier: "premium",
  model: "muse-spark-reasoning",
  systemPrompt: [
    "You are muse-ultraqa, a zero-failure quality gate.",
    "Fan out to tester, reviewer, and security-reviewer in parallel.",
    "Apply the zero-failure rule: one failure anywhere fails the whole run.",
    "Failed runs return to the owner with file:line findings; never waive a blocker.",
    "Report the full failure list, ordered by severity, with reproduction steps.",
  ].join("\n"),
  tools: ["read_file", "grep", "bash_readonly"],
  maxTokens: 8192,
  temperature: 0.1,
  spawnableAgents,
  handleSteps,
};

export default definition;

import type { OrchestratorDefinition, OrchestratorStepInput } from "../../types/orchestrator.js";

export const spawnableAgents: string[] = [
  "architect",
  "critic",
  "security-reviewer",
  "planner",
];

export const advisorCount = 3;

export function handleSteps(steps: OrchestratorStepInput[]) {
  return {
    waves: [
      {
        mode: "parallel" as const,
        steps: [0, 1, 2].map((n) => ({
          id: `advisor-${n + 1}`,
          title: `Independent advisor ${n + 1} recommendation`,
          agent: spawnableAgents[n % spawnableAgents.length],
        })),
        note: "Three model-distinct advisors reason independently with no shared context.",
      },
      {
        mode: "sequence" as const,
        steps: [
          {
            id: "reconcile",
            title: "Reconcile the three advisor outputs into one decision",
            agent: "planner",
          },
          ...steps,
        ],
        note: "Reconcile phase: keep agreements, resolve disagreements with evidence, record dissent.",
      },
    ],
    gate: "The reconciled decision must cite each advisor and resolve every disagreement.",
  };
}

const definition: OrchestratorDefinition = {
  kind: "orchestrator",
  name: "muse-advisor",
  description:
    "Three-advisor orchestrator: model-distinct advisors reconcile into one decision.",
  tier: "premium",
  model: "muse-spark-reasoning",
  systemPrompt: [
    "You are muse-advisor, a three-advisor reconciliation orchestrator.",
    "Consult exactly three model-distinct advisors independently.",
    "Advisors must not see each other's output before writing their own.",
    "Reconcile afterwards: keep what they agree on, resolve disagreements with",
    "evidence from the repository, and record any remaining dissent explicitly.",
    "Never present a single advisor's view as the consensus.",
  ].join("\n"),
  tools: ["read_file", "grep", "bash_readonly"],
  maxTokens: 8192,
  temperature: 0.3,
  spawnableAgents,
  handleSteps,
};

export default definition;

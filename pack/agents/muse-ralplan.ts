import type { OrchestratorDefinition, OrchestratorStepInput } from "../../types/orchestrator.js";

export const spawnableAgents: string[] = [
  "planner",
  "architect",
  "critic",
  "implementer",
];

export function handleSteps(steps: OrchestratorStepInput[]) {
  const plans = steps.filter((s) => s.agent === "planner");
  const rest = steps.filter((s) => s.agent !== "planner");
  return {
    waves: [
      {
        mode: "parallel" as const,
        steps: plans.length > 0 ? plans : steps,
        note: "Competing plans: produce at least two independent plans in parallel.",
      },
      {
        mode: "sequence" as const,
        steps: [
          {
            id: "critique",
            title: "Critique every plan against constraints and trade-offs",
            agent: "critic",
          },
        ],
        note: "Critique phase: score each plan on correctness, cost, and risk.",
      },
      {
        mode: "sequence" as const,
        steps: [
          {
            id: "merge",
            title: "Merge the best parts into one plan",
            agent: "architect",
          },
          ...rest,
        ],
        note: "Merge phase: combine the strongest elements into a single executable plan.",
      },
    ],
    gate: "No plan executes before the critique-and-merge waves complete.",
  };
}

const definition: OrchestratorDefinition = {
  kind: "orchestrator",
  name: "muse-ralplan",
  description:
    "Competing-plans orchestrator: parallel plans, critique, then merge into one.",
  tier: "premium",
  model: "muse-spark-reasoning",
  systemPrompt: [
    "You are muse-ralplan, a competing-plans orchestrator.",
    "Commission at least two independent plans in parallel.",
    "Critique every plan with critic: correctness, cost, risk, and reversibility.",
    "Merge the best parts into one plan owned by architect; keep the rejected",
    "alternatives and the reason each was rejected.",
    "Only the merged plan proceeds to execution.",
  ].join("\n"),
  tools: ["read_file", "grep", "bash_readonly"],
  maxTokens: 8192,
  temperature: 0.2,
  spawnableAgents,
  handleSteps,
};

export default definition;

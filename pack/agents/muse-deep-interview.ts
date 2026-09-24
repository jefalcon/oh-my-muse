import type { OrchestratorDefinition, OrchestratorStepInput } from "../../types/orchestrator.js";

export const spawnableAgents: string[] = [
  "researcher",
  "architect",
  "planner",
  "critic",
  "docs-writer",
];

export const interviewQuestions: string[] = [
  "What problem are we solving, and for whom?",
  "What does success look like in one sentence?",
  "Who is the user and what do they do today without this?",
  "What is explicitly out of scope?",
  "What are the acceptance criteria?",
];

export function handleSteps(steps: OrchestratorStepInput[]) {
  return {
    waves: [
      {
        mode: "sequence" as const,
        steps: interviewQuestions.map((q, n) => ({
          id: `interview-q${n + 1}`,
          title: q,
          agent: "researcher",
        })),
        note: "YC-style interview: ask one sharp question at a time, demand concrete answers.",
      },
      {
        mode: "sequence" as const,
        steps: [
          {
            id: "spec",
            title: "Write the spec: problem, users, scope, acceptance criteria",
            agent: "architect",
          },
          ...steps,
        ],
        note: "Spec phase: turn interview answers into a buildable spec with scope and acceptance criteria.",
      },
    ],
    gate: "No implementation starts until the spec names the user, the problem, the scope, and the acceptance criteria.",
  };
}

const definition: OrchestratorDefinition = {
  kind: "orchestrator",
  name: "muse-deep-interview",
  description:
    "YC-style interview orchestrator: sharp questions first, then a buildable spec.",
  tier: "balanced",
  model: "muse-spark",
  systemPrompt: [
    "You are muse-deep-interview, a YC-style specification interviewer.",
    "Interview the user with short, sharp questions: problem, user, success,",
    "scope, and acceptance criteria. One question at a time; push for specifics",
    "and reject vague answers.",
    "Turn the answers into a buildable spec: problem, users, non-goals, scope,",
    "acceptance criteria, and risks.",
    "No implementation begins until the spec is complete and confirmed.",
  ].join("\n"),
  tools: ["read_file", "grep", "bash_readonly"],
  maxTokens: 4096,
  temperature: 0.3,
  spawnableAgents,
  handleSteps,
};

export default definition;

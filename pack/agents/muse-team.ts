import type { OrchestratorDefinition, OrchestratorStepInput } from "../../types/orchestrator.js";

export const spawnableAgents: string[] = [
  "researcher",
  "planner",
  "implementer",
  "tester",
  "reviewer",
  "critic",
];

export function handleSteps(steps: OrchestratorStepInput[]) {
  const readOnly = steps.filter(
    (s) => s.agent === "researcher" || s.agent === undefined,
  );
  const writes = steps.filter(
    (s) => s.agent !== undefined && s.agent !== "researcher",
  );
  const byFile = new Map<string, OrchestratorStepInput[]>();
  const noFile: OrchestratorStepInput[] = [];
  for (const step of writes) {
    if (!step.files || step.files.length === 0) {
      noFile.push(step);
      continue;
    }
    const key = [...step.files].sort().join("\u0000");
    const group = byFile.get(key);
    if (group) group.push(step);
    else byFile.set(key, [step]);
  }
  return {
    waves: [
      ...(readOnly.length > 0
        ? [
            {
              mode: "parallel" as const,
              steps: readOnly,
              note: "Default parallel research: read-only steps run together.",
            },
          ]
        : []),
      ...[...byFile.values()].map((group) => ({
        mode: "sequence" as const,
        steps: group,
        note: "Serialized same-file edits: steps touching the same files run in order.",
      })),
      ...(noFile.length > 0
        ? [
            {
              mode: "parallel" as const,
              steps: noFile,
              note: "File-independent writes run in parallel.",
            },
          ]
        : []),
      {
        mode: "sequence" as const,
        steps: [
          {
            id: "review-loop",
            title: "Reviewer loop over changed files",
            agent: "reviewer",
            files: writes.flatMap((s) => s.files ?? []),
          },
        ],
        note: "Reviewer loop: re-run reviewer until verdict is approve.",
      },
    ],
    gate: "Reviewer must approve; same-file edits never run in parallel.",
  };
}

const definition: OrchestratorDefinition = {
  kind: "orchestrator",
  name: "muse-team",
  description:
    "Default team orchestrator: parallel research, serialized same-file edits, reviewer loop.",
  tier: "balanced",
  model: "muse-spark",
  systemPrompt: [
    "You are muse-team, the default team orchestrator.",
    "Run read-only research steps in parallel.",
    "Serialize edits that touch the same files; parallelize only file-independent work.",
    "Finish every run with the reviewer loop: send the diff to reviewer and",
    "fix blocking findings until the verdict is approve.",
    "Never report done while reviewer findings are open.",
  ].join("\n"),
  tools: ["read_file", "grep", "bash_readonly"],
  maxTokens: 4096,
  temperature: 0.2,
  spawnableAgents,
  handleSteps,
};

export default definition;

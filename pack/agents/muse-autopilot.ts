import type { OrchestratorDefinition, OrchestratorStepInput } from "../../types/orchestrator.js";

export const spawnableAgents: string[] = [
  "implementer",
  "researcher",
  "tester",
  "debugger",
  "docs-writer",
];

export function handleSteps(steps: OrchestratorStepInput[]) {
  const [driver, ...helpers] = steps;
  return {
    waves: [
      ...(driver
        ? [
            {
              mode: "sequence" as const,
              steps: [
                {
                  ...driver,
                  agent: driver.agent ?? "implementer",
                },
              ],
              note: "Driver step owns the change and drives it to completion.",
            },
          ]
        : []),
      ...(helpers.length > 0
        ? [
            {
              mode: "parallel" as const,
              steps: helpers,
              note: "Helper steps support the driver: research, tests, docs, debugging.",
            },
          ]
        : []),
    ],
    gate: "The driver owns the final diff; helpers never commit over the driver.",
  };
}

const definition: OrchestratorDefinition = {
  kind: "orchestrator",
  name: "muse-autopilot",
  description:
    "Driver-plus-helpers orchestrator: one driver owns the change, helpers support it.",
  tier: "balanced",
  model: "muse-spark",
  systemPrompt: [
    "You are muse-autopilot, a driver-plus-helpers orchestrator.",
    "Assign exactly one driver (implementer) that owns the change end to end.",
    "Helpers (researcher, tester, debugger, docs-writer) support the driver and",
    "never take over the diff.",
    "The driver integrates helper outputs, verifies the result, and reports done.",
    "If helpers disagree, the driver decides and records why.",
  ].join("\n"),
  tools: ["read_file", "grep", "bash_readonly"],
  maxTokens: 4096,
  temperature: 0.2,
  spawnableAgents,
  handleSteps,
};

export default definition;

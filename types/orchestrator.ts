import type { Tier } from "./agent-definition.js";

export interface OrchestratorStepInput {
  id: string;
  title: string;
  agent?: string;
  files?: string[];
  verifyCommand?: string;
  done?: boolean;
}

export interface OrchestratorWave {
  mode: "parallel" | "sequence";
  steps: OrchestratorStepInput[];
  note: string;
}

export interface OrchestratorPlan {
  waves: OrchestratorWave[];
  gate: string;
}

export type HandleSteps = (steps: OrchestratorStepInput[]) => OrchestratorPlan;

export interface OrchestratorDefinition {
  kind: "orchestrator";
  name: string;
  description: string;
  tier: Tier;
  model?: string;
  systemPrompt: string;
  tools?: string[];
  maxTokens?: number;
  temperature?: number;
  spawnableAgents: string[];
  handleSteps: HandleSteps;
}

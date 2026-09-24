export type Tier = "budget" | "balanced" | "premium";

export const TIER_MODELS: Record<Tier, string> = {
  budget: "muse-spark-fast",
  balanced: "muse-spark",
  premium: "muse-spark-reasoning",
};

export interface AgentDefinition {
  name: string;
  description: string;
  tier: Tier;
  model?: string;
  systemPrompt: string;
  tools?: string[];
  maxTokens?: number;
  temperature?: number;
}

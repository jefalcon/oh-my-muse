# Modes (Tiers)

`oh-my-muse` routes every agent through one of three cost/capability tiers.
Tiers are literal strings — always exactly `budget`, `balanced`, or `premium`.
Anything else is rejected by validation (`omm doctor`, `omm config set`).

## The three tiers

| Tier       | Model (default)        | Use for                              |
| ---------- | ---------------------- | ------------------------------------ |
| `budget`   | `muse-spark-fast`      | Fast, low-cost chat and triage       |
| `balanced` | `muse-spark`           | General coding work (default)        |
| `premium`  | `muse-spark-reasoning` | Deep reasoning, planning, hard bugs  |

The tier-to-model mapping lives in `TIER_MODELS` (`bin/lib.mjs`,
mirrored in `types/agent-definition.ts`) and per-tier defaults
(`maxTokens`) live in `models.json`.

## How a tier is chosen

1. `defaultTier` in `omm.jsonc` applies to agents that do not declare one.
   Default: `balanced`.
2. An agent's own `tier` field overrides the default.
3. An agent's explicit `model` field overrides the tier's model.
4. A preset (`omm preset <name> --apply <agent>`) can set tier, model,
   temperature, and maxTokens together (see `docs/MODEL-COMPATIBILITY.md`).

```jsonc
// omm.jsonc
{
  "defaultTier": "balanced", // budget | balanced | premium
  "agents": [
    {
      "name": "quick-chat",
      "tier": "budget",
      "systemPrompt": "You are a friendly chat assistant."
    },
    {
      "name": "deep-reasoner",
      "tier": "premium",
      "systemPrompt": "Think step by step."
    }
  ]
}
```

## Inspecting modes

- `omm list --dir <path>` shows each agent with its resolved tier and model.
- `omm config get defaultTier --dir <path>` prints the project default.
- `omm doctor --dir <path>` fails if any agent declares an invalid tier.
- `test/smoke.mjs` validates every `pack/agents/*.ts` file declares a
  valid tier literal.

## Rules

- Tiers are case-sensitive lowercase literals.
- `temperature` must be a number in `[0, 2]`; `maxTokens` must be a
  positive integer.
- Unknown tiers are never coerced or guessed — commands fail with an
  error naming the expected literals.

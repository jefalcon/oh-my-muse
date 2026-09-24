# Model Compatibility

This pack targets **Muse Spark** model IDs and optionally routes through
**OpenRouter** for compatible third-party models.

## Default model map

| Tier       | Default model          |
| ---------- | ---------------------- |
| `budget`   | `muse-spark-fast`      |
| `balanced` | `muse-spark`           |
| `premium`  | `muse-spark-reasoning` |

The map is defined once in `bin/lib.mjs` (`TIER_MODELS`) and mirrored for
types in `types/agent-definition.ts`. Per-tier token budgets live in
`models.json`:

```json
{
  "tiers": {
    "budget": { "model": "muse-spark-fast", "maxTokens": 2048 },
    "balanced": { "model": "muse-spark", "maxTokens": 4096 },
    "premium": { "model": "muse-spark-reasoning", "maxTokens": 8192 }
  }
}
```

## Presets (`models.json`)

Named presets bundle a tier with sampling defaults:

| Preset   | Tier       | Temperature |
| -------- | ---------- | ----------- |
| `code`   | `balanced` | `0.2`       |
| `chat`   | `budget`   | `0.7`       |
| `reason` | `premium`  | `0.1`       |

`customPresets` add user models without editing built-ins — for example
`example-local` pins tier `budget` with a custom `model` id. Apply a
preset with:

```sh
omm preset code --dir /absolute/path/to/project
omm preset reason --apply planner --dir /absolute/path/to/project
```

Applying a preset fills in a missing `model` from the preset tier via
`modelForTier`. Preset tiers must still be `budget|balanced|premium`.

## OpenRouter routing

Any model id prefixed with `openrouter/` is passed through to OpenRouter
instead of Muse Spark directly. Requirements:

- Export `OPENROUTER_API_KEY` in the environment.
- Prefer `$ENV` references in config so keys never land in `omm.jsonc`:

```jsonc
{
  "agents": [
    {
      "name": "third-party",
      "tier": "balanced",
      "model": "openrouter/some-compatible-model",
      "systemPrompt": "..."
    }
  ]
}
```

Secrets printed by `omm list`, `omm config show`, or errors are redacted
(`redactConfig` / `redactText` in `bin/lib.mjs`).

## Compatibility notes

- Node.js `>= 20` is required (ES modules, `node:test` runner).
- If `models.json` is absent, `loadModelsFile` returns empty tiers and
  presets; `omm doctor` reports the missing file.
- Unknown preset names fail with the list of available presets — names
  are never fuzzy-matched.

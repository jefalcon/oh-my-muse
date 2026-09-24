# Parity (oh-my-muse 0.2.0)

The 0.1.x pack installed TypeScript agents under
`<project>/.claude/oh-my-muse`, which no runtime reads. 0.2.0 is a native
Muse Code plugin (`plugin/.muse-plugin/plugin.json`, validated by
`muse plugins validate`). Parity here means: every kept 0.1.x behavior has
a named 0.2.0 successor, and every removal is recorded with its reason.

## freebuff → Muse mapping

| 0.1.x (`pack/`)                | 0.2.0 (`plugin/`)                    | Status                     |
| ------------------------------ | ------------------------------------ | -------------------------- |
| `architect`                    | `skills/architect/SKILL.md`          | Ported (systemPrompt kept) |
| `critic`                       | `skills/critic/SKILL.md`             | Ported                     |
| `data-scientist`               | `skills/data-scientist/SKILL.md`     | Ported                     |
| `debugger`                     | `skills/debugger/SKILL.md`           | Ported                     |
| `designer`                     | `skills/designer/SKILL.md`           | Ported                     |
| `docs-writer`                  | `skills/docs-writer/SKILL.md`        | Ported                     |
| `file-picker`                  | `skills/file-picker/SKILL.md`        | Ported                     |
| `implementer`                  | `skills/implementer/SKILL.md`        | Ported                     |
| `planner`                      | `skills/planner/SKILL.md`            | Ported                     |
| `refactorer`                   | `skills/refactorer/SKILL.md`         | Ported                     |
| `researcher`                   | `skills/researcher/SKILL.md`         | Ported                     |
| `reviewer`                     | `skills/reviewer/SKILL.md`           | Ported                     |
| `security-reviewer`            | `skills/security-reviewer/SKILL.md`  | Ported                     |
| `tester`                       | `skills/tester/SKILL.md`             | Ported                     |
| `muse-team`                    | `commands/omm-team.md`               | Ported (waves + gate prose)|
| `muse-autopilot`               | `commands/omm-autopilot.md`          | Ported                     |
| `muse-ultrawork`               | `commands/omm-ultrawork.md`          | Ported                     |
| `muse-pipeline`                | `commands/omm-pipeline.md`           | Ported                     |
| `muse-ultraqa`                 | `commands/omm-ultraqa.md`            | Ported                     |
| `muse-ralph`                   | `commands/omm-ralph.md`              | Ported                     |
| `muse-advisor`                 | `commands/omm-advisor.md`            | Ported (3 independent advisors; no model-distinct tiers) |
| `muse-deep-interview`          | —                                    | Removed: overlaps `grill` / `requirements-clarification` in muse-core |
| `muse-ralplan`                 | —                                    | Removed: overlaps `plan` in muse-core |
| skill `harness`                | `skills/harness/SKILL.md`            | Ported                     |
| skill `verify`                 | `skills/verify/SKILL.md`             | Ported                     |
| skill `docs`                   | `skills/docs/SKILL.md`               | Ported                     |
| skill `security`               | `skills/security/SKILL.md`           | Ported                     |
| skill `tdd`                    | —                                    | Removed: overlaps `durable-test-collateral` in muse-core |
| skill `design`                 | —                                    | Removed: overlaps `taste` in muse-core |
| `hooks/notify.mjs` (CLI-driven)| `plugin/hooks/notify.mjs` (single `omm-notify-stop` on `Stop`) | Ported, self-contained (node builtins only); allowlist, redaction, and file confinement preserved; Fase 5: config file `$HOME/.config/oh-my-muse/notify.json`, `SessionEnd` hook removed |
| tiers / presets / `models.json` / OpenRouter | —                         | Removed: the model is per session; tier driver deferred |
| `omm setup/install/update` (file staging) | `omm install` → `muse plugins install` | Replaced by the native installer |
| `omm list/preset/config/skill` | —                                    | Removed with the config layer |
| `omm doctor`                   | `omm doctor` (node, muse, validation) | Replaced                 |
| `omm notify`                   | `omm notify` (args + env + `$HOME/.config/oh-my-muse/notify.json`; `setup`/`test` subcommands) | Kept, extended (Fase 5) |

Dropped agent fields with no native equivalent: `tier`, `model`,
`tools`, `maxTokens`, `temperature`. The session model and the
orchestrator's closed specialist list replace them.

## How parity is verified

- `test/validators.test.mjs` runs the real validators: every
  `plugin/skills/*/SKILL.md` must return `valid: true` with zero
  diagnostics, then `muse plugins validate plugin` must do the same.
  Both skip cleanly when `muse` is not on `PATH` (publish CI has no Muse).
- `test/cli.test.mjs` keeps the notify/redaction coverage: webhook
  allowlists, secret redaction, file-channel confinement (lexical +
  symlink realpath), and the `sendFile` opt-out.
- `test/tarball.test.mjs` asserts `plugin/.muse-plugin/plugin.json`
  (plus skills, commands, hooks, `bin/omm.mjs`) ships in
  `npm pack --dry-run`, and that the removed `pack/` does not.
- `test/e2e.test.mjs` drives the CLI: help, `notify` file round-trip, a
  fake-`muse` shim asserting the exact `plugins install <dir> --scope`
  argv plus the printed (never executed) `approve` step, and clear-error
  paths when `muse` is missing.

## Upstream provenance (oh-my-freebuff)

This pack is adapted from `oh-my-freebuff` (MIT), retargeted at Muse
Code. It is not a fork kept in sync: agent names were renamed
(`omf-*` -> `muse-*`), the model/routing layer was replaced, and 0.2.0
replaces the file-staging installer with the native plugin contract.

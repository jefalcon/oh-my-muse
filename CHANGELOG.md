# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.2.1] - 2026-09-24

### Fixed

- The 7 orchestrator commands (`omm-team`, `omm-autopilot`,
  `omm-ultrawork`, `omm-pipeline`, `omm-ultraqa`, `omm-ralph`,
  `omm-advisor`) now order real orchestration: in 0.2.0 `/omm-team`
  ran with no Workflow at all (no `subagent/` folder in the session;
  only `read_skill`, `write_file`, `edit_file` and `bash` on the main
  thread). Commands are now imperative ("DEBES"), start with
  `read_skill bundled:workflow-authoring`, forbid main-thread
  implementation except final integration, and stop explicitly when
  the Workflow tool is unavailable.

### Changed

- One Workflow call per wave (never a single workflow for everything)
  so the parent narrates between waves; user-visible progress
  contract (plan before launching, per-child role + findings + files
  + `unresolved` plus gate decision after each wave, final report);
  every child `input` starts with "Primero llama a read_skill
  plugin:oh-my-muse:\<rol\>." with the `complete`/`evidence`/`unresolved`
  schema within the 4096-byte UTF-8 limit. Each orchestrator keeps its
  own pattern as explicit waves.
- New `docs/SMOKE-ORCHESTRATION.md`: manual check that a command
  orchestrated (session `subagent/` folder, subagent count,
  per-role `read_skill`). Not automated in CI.
- `docs/OPEN-QUESTIONS.md` O4 resolved: a Stop hook reached
  api.telegram.org and discord.com (HTTP 200) with the sandbox active.
- `--message` help clarifies `$ENV` expands only from the CLI, never
  from the hook (Muse filters hook env).
- New static test `test/orchestration.test.mjs` (registered in
  `npm test`) asserting the orchestration contract markers in all 7
  commands.
- `CONTRIBUTING.md` gains a `Release` section (`v*` tag →
  `publish.yml` via npm OIDC trusted publishing; never `npm publish`
  by hand) and no longer uses an absolute checkout path.
- New hygiene test `test/hygiene.test.mjs` (registered in `npm test`):
  fails if any `git ls-files` entry contains `/home/<user>` or
  `/Users/<user>`, or if `docs/muse-recon/` exists.

### Removed

- `docs/muse-recon/` (unpublished maintainer recon of Muse Code 1.3.0:
  local paths, session IDs, third-party skill text): untracked from
  git, added to `.gitignore`; its citation in
  `docs/OPEN-QUESTIONS.md` now reads "evidencia local del mantenedor
  (recon de Muse Code 1.3.0, no publicada)".
- `AUDIT_REPORT.md`: 0.1.0 audit, superseded by the 0.2.x validator
  and test gates.
- `hooks/notify.mjs`: dead 0.1.x code referenced by nothing (the CLI
  and the plugin hook both use `plugin/hooks/notify.mjs`).
- `src/harness/`: referenced by nothing; the live harness contract is
  `plugin/skills/harness/SKILL.md` plus each command's Gate section
  (its gate table still named removed agents and tiers).
- `READY_TO_PUBLISH.md`: folded into the `Release` section of
  `CONTRIBUTING.md`.

### Added

- New non-invocable skill `plugin/skills/omm-narration/SKILL.md`: the
  single source of the narration templates in the user's language
  (start card `## 🏮 OMM …` with plan table after loading
  `bundled:table-fit`, per-wave `### ▶ …` header with roster, per-wave
  `✔`/`⚠`/`✖` card with `**Gate:**`/`**Siguiente:**`, closing
  `## ✅ Hecho` with real `git diff --stat`, literal test output,
  pending items and next step). Fixed sober icons (🏮 ▶ ✔ ⚠ ✖ ✅);
  no JSON in the narration: the Workflow result is for the parent,
  the user sees the card.
- `docs/OPEN-QUESTIONS.md` D4/O5: B1 findings from regenerating
  `muse schema generate-ts` on 1.3.0 — no model-settable per-workflow
  name (only per-child `label`/`phase`, e.g. `w2-implementer`);
  `log()` visibility unverified, so narration never depends on it.

### Changed (narration)

- The 7 commands now also require `read_skill
  plugin:oh-my-muse:omm-narration` after `bundled:workflow-authoring`,
  forbid chaining two Workflow calls without the wave-end card and the
  next wave header in between, and extend each child schema with
  `summary` (max 2 lines), `files[]` and `decisions[]` inside the
  4096-byte limit; each child call carries `label: "w<N>-<rol>"`.
- `docs/SMOKE-ORCHESTRATION.md` gains the on-screen visual checklist.
- `test/orchestration.test.mjs` also asserts the narration contract
  (skill load + no-chaining rule in all 7 commands, four templates in
  the skill).

## [0.2.0] - 2026-09-24

### **BREAKING**

- The 0.1.x TypeScript pack under `.claude/oh-my-muse` is gone. The
  project now ships a native Muse Code plugin (`plugin/`).
- Removed commands and their equivalents:
  - `omm setup` / `install` (file staging) → `omm install [--scope
    user|project]` (runs `muse plugins install`, then prints the pending
    `muse plugins approve oh-my-muse` step without executing it).
  - `omm update` → `muse plugins update oh-my-muse`.
  - `omm list` / `preset` / `config` / `skill` → removed with the tier +
    config layer (model is chosen per session via `muse --model` or
    `settings.json`).
  - `omm doctor` → kept, now checks node, `muse` in PATH, version, and
    both validators.
  - `omm notify` → kept, simplified to args + env (no project config).
- Removed: `pack/`, `types/`, `models.json`, `omm.jsonc`, `tsconfig.json`,
  `test/smoke.mjs`, `docs/MODES.md`, `docs/MODEL-COMPATIBILITY.md`,
  `npm run typecheck` / `npm run smoke`, and the `typescript`
  devDependency.
- Removed overlapping agents/skills (see `docs/PARITY.md`): skill `tdd`
  (muse-core `durable-test-collateral`), skill `design` (muse-core
  `taste`), `muse-deep-interview` (muse-core `grill` /
  `requirements-clarification`), `muse-ralplan` (muse-core `plan`).
- Removed tiers, presets, and OpenRouter routing. Dropped agent fields
  with no native equivalent: `tier`, `model`, `tools`, `maxTokens`,
  `temperature`.

### Added

- Native plugin `oh-my-muse` 0.2.0: 18 skills (`architect`, `critic`,
  `data-scientist`, `debugger`, `designer`, `docs-writer`, `file-picker`,
  `implementer`, `planner`, `refactorer`, `researcher`, `reviewer`,
  `security-reviewer`, `tester`, `harness`, `verify`, `docs`,
  `security`), 7 commands (`omm-team`, `omm-autopilot`, `omm-ultrawork`,
  `omm-pipeline`, `omm-ultraqa`, `omm-ralph`, `omm-advisor`), and 1 hook
  (`omm-notify-stop` on `Stop`, self-contained `plugin/hooks/notify.mjs`).
- Notify config file (Fase 5 hotfix, still unreleased): hooks never saw
  `OMM_NOTIFY_CHANNEL` because Muse filters the hook environment, and
  `Stop` fires at the end of every turn. The hook now reads only
  `$HOME/.config/oh-my-muse/notify.json` (via `os.homedir()`; no
  `XDG_CONFIG_HOME`): `channel`, `webhookUrl`, `botToken`, `chatId`,
  `file`, `message`, `allowExternalFile`, `includeAssistantMessage`
  (default false). `OMM_*` overrides the file for CLI use only.
  Owner-only modes enforced (`0600` file / `0700` dir; the hook sends
  nothing and `omm doctor` fails otherwise). `omm notify setup` writes
  the file without ever printing secrets; `omm notify test` sends using
  it; `omm doctor` reports path, mode, and channel. The `SessionEnd`
  hook (`omm-notify-end`, `notify-end.mjs`) is removed; the single
  `Stop` hook points directly at `hooks/notify.mjs`. `stop_hook_active`
  payloads and non-object stdin are silent no-ops (always exit 0).
- `docs/OPEN-QUESTIONS.md`: schema findings (no workflow-launch entry,
  full valid hook-event list, `duplicate-hook-source`).
- Tests: real validators with `t.skip()` when `muse` is absent, kept
  notify/redaction coverage, tarball-content test, CLI round-trips with a
  fake-`muse` shim.

## [0.1.1] - 2026-09-24

### Fixed

- Drop `registry-url` from the publish workflow to allow OIDC token
  exchange (fixes 403 OIDC permission denied).
- Use Node 24 for npm OIDC trusted publishing (requires npm 11.5.1+).

## [0.1.0] - 2026-09-24

### Added

- Pack manager CLI (`bin/omm.mjs`) with `setup`, `install`, `update`,
  `uninstall`, `doctor`, `list`, `preset`, `config`, `skill`, and
  `notify` commands.
- Shared library (`bin/lib.mjs`): tier literals `budget|balanced|premium`,
  JSONC config handling, `$ENV` expansion, secret redaction, `https`-only
  webhooks, atomic staging installs, and managed-file manifests.
- Notification hooks (`hooks/notify.mjs`) for telegram, discord, slack,
  and file channels with template rendering.
- Agent pack (`pack/agents`, 23 agents) and skills (`pack/skills`:
  design, docs, harness, security, tdd, verify).
- Tiered model presets (`models.json`) with OpenRouter (`openrouter/`)
  routing support.
- Tests: `test/cli.test.mjs` (unit), `test/e2e.test.mjs` (install and
  CLI round-trips in isolated tmp dirs), `test/smoke.mjs` (agent shape
  validation).
- Docs: `docs/MODES.md`, `docs/MODEL-COMPATIBILITY.md`, `docs/PARITY.md`.
- CI (`.github/workflows/ci.yml`): typecheck, tests, smoke, and a
  weekly canary run.

### Fixed

- H1: notification file channel confined to the project root (lexical +
  symlink realpath check, `allowExternalNotificationFile` opt-in).
- M1: custom preset `extends` + inheritance-cycle detection +
  `modelOverrides` (unknown-agent / empty-model rejection, overrides win).
- M2: `webhookUrl` validated (https + discord/slack host allowlists) in
  config validation, doctor, and at send time.
- M3: committed `package-lock.json` so CI `npm ci` works on fresh checkouts.
- M4: `redactText` scrubs discord/slack webhook URLs.
- L1: `skill list` no longer follows symlinks. L2: `.gitignore` covers
  `.claude/`. L3: `package.json` publish metadata (keywords, files).
- Publish metadata: real repo URL (`github.com/jefalcon/oh-my-muse`),
  `repository`/`homepage`/`bugs`, LICENSE upstream attributions.

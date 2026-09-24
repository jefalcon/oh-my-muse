# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
  `omm-pipeline`, `omm-ultraqa`, `omm-ralph`, `omm-advisor`), and 2 hooks
  (`omm-notify-stop` on `Stop`, `omm-notify-end` on `SessionEnd`) sharing
  a self-contained `plugin/hooks/notify.mjs`.
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

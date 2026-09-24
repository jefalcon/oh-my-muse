# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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

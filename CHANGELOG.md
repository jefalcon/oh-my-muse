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

# Contributing

## Setup

Requires Node.js `>= 20`. No runtime dependencies; TypeScript is the
only dev dependency (for `npm run typecheck`).

```sh
cd /absolute/path/to/oh-my-muse
npm install   # dev tooling only (typescript)
npm run typecheck
npm test
node test/smoke.mjs
```

## Conventions

- ES modules only (`"type": "module"`). All paths handled as absolute
  (`path.resolve`); never assume cwd.
- Tiers are literal strings `budget|balanced|premium` — see
  `docs/MODES.md`. Never add a synonym or coerce unknown values.
- No unfinished placeholders or stub code in committed files. Every
  file must be complete and passing.
- Config files use JSONC (comments allowed); parse via `stripJsonc` /
  `parseJsonc` from `bin/lib.mjs`.
- Secrets: use `$ENV` / `${VAR:-default}` references, keep `omm.jsonc`
  at mode `0600`, use `https` webhooks only, and run output through
  `redactConfig` / `redactText`.

## Tests

- `test/cli.test.mjs` — unit tests for `bin/lib.mjs` pure functions
  (tiers, paths, JSONC, env expansion, redaction, presets, validation).
- `test/e2e.test.mjs` — full CLI and install/update/uninstall
  round-trips in isolated `fs.mkdtempSync(os.tmpdir())` directories.
- `test/smoke.mjs` — agent shape validation over `pack/agents/*.ts`
  plus `models.json` and `omm.jsonc` checks.

Run the whole gate before opening a PR:

```sh
npm run typecheck && npm test && node test/smoke.mjs
```

## Pull requests

- Keep changes focused; one concern per PR.
- Add or update tests alongside behavior changes.
- Update `CHANGELOG.md` under a new `Unreleased` section.
- Ensure `omm doctor` passes against a scratch project.

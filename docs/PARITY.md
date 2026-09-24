# Parity

Parity means: the copy installed under `<project>/.claude/oh-my-muse`
behaves exactly like the `pack/` + `types/` sources in this repository,
except for the project-local `omm.jsonc`.

## What install guarantees

- `omm install --dir <path>` collects every file under `pack/` and
  `types/` (`collectPackFiles`), stages them in a temporary directory,
  then atomically renames staging over the destination
  (`stageAndCommit`). A failed install leaves the previous destination
  untouched (backup restore).
- The project config template is seeded from the repository-root
  `omm.jsonc` on first install only. Re-installs and updates never
  overwrite an existing project `omm.jsonc`.
- Every install and update writes `omm-managed.json`, the manifest of
  tracked files plus `installedAt`/`updatedAt` timestamps.
- `omm.jsonc` is always written with mode `0600` (`writeFileMode`).

## What update guarantees

- `omm update --dir <path>` re-collects current `pack/` + `types/` files,
  stages, and atomically swaps — the same path as install.
- The existing project `omm.jsonc` is carried into the new staging
  directory verbatim, so local agents, tiers, and notify hooks survive.
- Files tracked by the previous manifest but no longer shipped are
  deleted from the destination (except the manifest itself, which is
  rewritten). Project-untracked files outside the manifest are left alone.

## What uninstall guarantees

- `omm uninstall --dir <path>` removes exactly the files listed in
  `omm-managed.json` (`listManagedFiles`), then prunes newly empty
  directories. With no manifest, it removes the install directory.
- Config values are never exfiltrated: uninstall deletes local files,
  it does not print them.

## How parity is verified

- `test/e2e.test.mjs` runs the full round-trip in isolated absolute
  temporary directories: setup, install, list, doctor, update,
  uninstall — plus manifest and `0600` permission assertions.
- `test/smoke.mjs` validates every `pack/agents/*.ts` agent shape
  (name, description, literal tier, systemPrompt, `AgentDefinition`).
- `omm doctor --dir <path>` re-checks the installed side: Node version,
  `models.json`, `pack/`, config load + validation, `0600` mode,
  manifest presence, webhook `https`, and tier literals.
- The weekly canary in `.github/workflows/ci.yml` re-runs typecheck,
  tests, and smoke on a schedule to catch drift.

## Non-goals

- The installed copy does not track uncommitted working-tree edits;
  parity is against the committed `pack/` + `types/` content at the
  installed revision.
- `omm.jsonc` is intentionally divergent per project and is excluded
  from parity.

## Upstream provenance (oh-my-freebuff)

This pack is adapted from `oh-my-freebuff` (MIT), retargeted at Muse
Spark. It is not a fork kept in sync: names are renamed (`omf-*` ->
`muse-*`, `omf.jsonc` -> `omm.jsonc`, `.freebuff` -> `.claude/oh-my-muse`)
and the model/routing layer is replaced (OpenRouter tiers ->
`muse-spark-fast` / `muse-spark` / `muse-spark-reasoning`).

Live diff against upstream `main`, verified 2026-09-24:

| Upstream | oh-my-muse | Status |
|---|---|---|
| 26 agents (9 orchestrators + 14 specialists + advisor-a/b/c panel) | 23 agents; advisor-a/b/c consolidated into `muse-advisor` | Intentional adaptation |
| `resolveNotificationFile` root confinement + symlink realpath check + `allowExternalNotificationFile` opt-in | Ported to `bin/lib.mjs` (same messages) | Parity restored (audit fix) |
| `validateWebhookUrl` slack/discord host allowlists | Ported to `bin/lib.mjs`, enforced in config validation, doctor, and send-time | Parity restored (audit fix) |
| Custom preset `extends` + inheritance-cycle error + `modelOverrides` (unknown-agent / empty-model rejection, overrides win) | Ported to `bin/lib.mjs` (`resolvePreset`, `validateModelOverrides`, `applyModelOverrides`); default base is `{ tier: "balanced" }` | Parity restored (audit fix) |
| `--global`/`--force`/`--show-secrets`, user `<` project config scopes, colored CLI output | Not ported; single project scope, secrets always redacted | Intentional simplification (gap if upstream UX is wanted) |
| `agents.manifest.json`, `templates/`, multi-skill `skills/` dir | Not ported; 6 built-in skills under `pack/skills/` | Intentional simplification |
| `package-lock.json` committed | Added during audit (CI `npm ci` requires it) | Parity restored (audit fix) |

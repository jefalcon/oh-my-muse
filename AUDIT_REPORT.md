# AUDIT REPORT — oh-my-muse (2026-09-24)

Method: 5 parallel research agents (inventory, upstream parity, `bin/`+`hooks`
line-by-line, agents+harness, tests/CI/package) + critic + gap follow-up,
then parent-verified against the real code with a live clone of
`oh-my-freebuff` `main`. Baseline before fixes: 31/31 tests, typecheck
clean, doctor exit 0, smoke 23 agents / 3 presets. After fixes: **46/46**,
typecheck clean, doctor exit 0, smoke 23/3, `npm pack --dry-run` ok.

## Executive summary

**Not yet ready for `npm publish` / `git push` — fix-first, then publish.**
The code is small, stdlib-only, and structurally sound; the audit found one
high-severity parity gap (unconfined notify file channel, now fixed), three
lost upstream safety features (ported back), one broken CI gate (fixed), and
two publish blockers that need a human (no git remote: README badges and
install URLs still point at `github.com/example`; no `repository` field).

## Inventory and structure

41 tracked files after audit. Verified present: `pack/agents/` 23 agents
(9 orchestrators `muse-*` + 14 specialists), `bin/omm.mjs` + `bin/lib.mjs`
ESM stdlib-only (imports: `child_process.execFileSync`, `fs`, `path`, `os`
only; no `shell:true`), `hooks/notify.mjs` (telegram/discord/slack/file +
`{{projectName}}` templates), `pack/skills/` (tdd, verify, design, harness,
security, docs), `models.json` (tiers budget/balanced/premium ->
muse-spark-fast/spark/reasoning; presets code/chat/reason), `docs/`
(MODES, MODEL-COMPATIBILITY, PARITY, CHANGELOG, CONTRIBUTING, SECURITY),
`test/` (cli, e2e, smoke), `.github/workflows/ci.yml` (push/PR + weekly
Monday canary). `src/harness/HARNESS.md` (1.7KB) and `DESIGN.md` (1.2KB)
exist but are thin vs the 2KB/5KB aspiration — MEDIUM docs finding, not
expanded (invented methodology prose would be slop).

## Parity vs upstream (live diff, see `docs/PARITY.md`)

Upstream has 26 agents; the only agents we lack are advisor-a/b/c,
consolidated into `muse-advisor` (intentional). Ported back during this
audit: notification-file confinement, webhook host allowlists, preset
`extends` + cycle detection + `modelOverrides`. Deliberately not ported:
`--global`/`--force`/`--show-secrets`, user`<`project config scopes,
colored output, `agents.manifest.json`, `templates/`.

## Findings

### HIGH (fixed + tested)

- **H1 — Unconfined notify file channel.** `hooks/notify.mjs:64-69`
  (`sendFile` did `path.resolve` + `mkdir -p` + append on any path).
  Any project config could append to arbitrary writable files on
  `omm notify`. Fix: `resolveNotificationFile` in `bin/lib.mjs`
  (lexical `isInside` check + `realpath` symlink-escape check, same
  messages as upstream), enforced in `sendFile`/`sendNotification`;
  config-driven external paths require `allowExternalNotificationFile=true`
  (config) or `OMM_ALLOW_EXTERNAL_NOTIFY_FILE=1` (env); explicit CLI
  `--file` opts out as the user's own action. Tests: lexical escape,
  symlink escape, opt-in, e2e refusal + opt-in round-trip.

### MEDIUM (fixed + tested)

- **M1 — Lost preset `extends` / cycle detection / `modelOverrides`.**
  `bin/lib.mjs` `getPreset` was a flat map merge; the `extends`,
  cycle-error, and override-pin semantics the feature spec describes were
  never implemented. Fix: `resolvePreset` (custom = partial overlay over
  `{ tier: "balanced" }`, same-name builtin, or `extends` target;
  unknown base and cycles throw), `validateModelOverrides` (object,
  known-agent keys, non-empty ids; wired into `validateConfig`),
  `applyModelOverrides` (wins over preset in `list` and `preset --apply`).
  6 new unit tests + e2e pin-survives-preset test.
- **M2 — `webhookUrl` never validated.** `bin/lib.mjs` `validateConfig`
  and `doctor` checked only `hook.url`; discord/slack webhooks lived in
  `hook.webhookUrl`. Fix: shared `validateNotifyHook` + ported
  `validateWebhookUrl` (https + provider host allowlists), enforced at
  config validation, doctor, and send-time (`sendDiscord`/`sendSlack`).
- **M3 — CI gate broken on fresh checkout.** `.github/workflows/ci.yml`
  runs `npm ci` but no `package-lock.json` was committed. Fix: generated
  and committed `package-lock.json` (stdlib-only runtime; lock covers the
  typescript devDep).
- **M4 — Secret redaction missed webhook URLs.** `redactText`
  (`bin/lib.mjs`) scrubbed telegram/xox/PEM only; discord/slack webhook
  URLs (token-in-path) could leak into error output. Fix: provider
  webhook patterns added (unit-tested).

### LOW (fixed + tested)

- **L1 — `skill list` followed symlinks.** `bin/omm.mjs:241` used
  `statSync().isDirectory()`. Fix: `lstatSync`, symlinks skipped.
- **L2 — `.gitignore` didn't cover the install dir.** Project-local
  `.claude/oh-my-muse/omm.jsonc` may hold secrets. Fix: `.claude/` added.
- **L3 — `package.json` publish metadata.** Missing `keywords`, `author`,
  `files` whitelist. Fix: added (whitelist includes `omm.jsonc`, which
  `installPack` seeds from).

### Accepted / informational (not changed)

- **A1 — `configHasSecrets` key allowlist** (`bin/lib.mjs:103`): oddly-named
  secret keys skip the 0600 doctor gate. Accepted: all repo writers emit
  0600 unconditionally; the gate is a backstop, and fail-closed would false-
  positive on benign configs. Documented here instead.
- **A2 — `--dir` accepts any path by design** (typo risk only); HELP
  documents absolute-path behavior.
- **A3 — Pipeline `verifyCommand` exit-0 gates are prompt-level**, not
  executed by the CLI (no runner; only `execFileSync("git", ...)` exists).
  Upstream-equivalent; documented, not implemented — a runner would be a
  new feature with its own sandbox requirements.
- **A4 — Reviewer-class agents** (reviewer, security-reviewer, critic)
  declare read-only tools; orchestrators carry `spawnableAgents` +
  research->plan->build->test->review flow; model routing matches spec
  (file-picker/researcher budget, architect/reviewer/security premium).

## Test coverage gaps (remaining)

- Live `POST` to telegram/discord/slack is never exercised (network +
  credentials); validation + redaction are tested, delivery is not.
- Atomic-update failure injection (crash between staging swap and backup
  restore) has no test; `stageAndCommit` restore path is review-only.
- `HARNESS.md`/`DESIGN.md` thinness (see above).

## Publish checklist

- [x] 46/46 tests, typecheck clean, doctor exit 0, smoke 23/3, pack dry-run ok
- [x] `package-lock.json` committed; `files` whitelist; `.gitignore` covers `.claude/`
- [ ] Set a git remote and replace `github.com/example` in README badges/links
      (4+ occurrences) + add `repository` to `package.json` — **human required**
- [ ] Decide version (`0.1.0`) and changelog entry for the audit fixes
- [ ] `git push`, then `npm publish` (dry-run already passes: 41 files, 26.9 kB)
- [ ] Re-run weekly canary after first publish

## Recommendation

**Fix-first, then publish — and the fixes are done except the human step.**
Merge this audit branch, set the real repo URL (checklist above), push, and
publish. No re-generation needed.

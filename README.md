# oh-my-muse

> **Archived.** This project is no longer maintained. A benchmark against
> plain Muse Code found no evidence that omm adds value; see
> [Benchmark: does omm add value over Muse Code?](#benchmark-does-omm-add-value-over-muse-code).

[![CI](https://github.com/jefalcon/oh-my-muse/actions/workflows/ci.yml/badge.svg)](https://github.com/jefalcon/oh-my-muse/actions/workflows/ci.yml)
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![ESM](https://img.shields.io/badge/modules-ESM-yellow)](package.json)

Native [Muse Code](https://github.com/anthropics/muse-code) plugin:
19 specialist skills, 7 orchestrator commands, turn/session-end
notifications, and wave-by-wave progress in the Workflow names.
No tiers, no presets, no model routing — the model is chosen
per session (see below).

## Install

Requires Node.js `>= 20` and Muse Code `1.3.0+` with `muse` on `PATH`.

```sh
npm install -g oh-my-muse
omm install
omm install --scope user   # or: --scope project
```

`omm install` resolves the shipped `plugin/` directory from the installed
package (never from the cwd) and runs `muse plugins install <plugin-dir>`.
It then prints a pending step it deliberately does **not** execute:

```sh
muse plugins approve oh-my-muse
```

Run that yourself to trust and enable the plugin. Verify any time with:

```sh
omm validate   # both real validators: skills, then plugin
omm doctor     # node, muse in PATH, muse version, validation
```

## Choosing the model

There are no tiers or presets in 0.2.0. The session model applies to every
skill and command. Pick it per invocation or persistently:

```sh
muse --model muse-spark-1.3-contributor
```

or in `${XDG_CONFIG_HOME:-$HOME/.config}/muse/settings.json`:

```json
{ "schema_version": 1, "model": "muse-spark-1.3-contributor" }
```

(A tier-driven `muse exec` wrapper is deferred to a later version.)

## Use

Commands (each loads `workflow-authoring` and runs its wave plan + gate):

| Command          | Orchestration                                             |
| ---------------- | --------------------------------------------------------- |
| `/omm-team`      | Parallel research, serialized same-file edits, reviewer loop |
| `/omm-autopilot` | One driver owns the change, helpers support it            |
| `/omm-ultrawork` | Maximum parallelism for independent steps                 |
| `/omm-pipeline`  | Strict sequence with a verify-command gate per step       |
| `/omm-ultraqa`   | Parallel checks under a zero-failure gate                 |
| `/omm-ralph`     | One unfinished step per loop iteration, pass/fail check   |
| `/omm-advisor`   | Three independent advisors reconciled into one decision   |

Skills (loaded by the model, `user-invocable: false`): `architect`,
`critic`, `data-scientist`, `debugger`, `designer`, `docs-writer`,
`file-picker`, `implementer`, `planner`, `refactorer`, `researcher`,
`reviewer`, `security-reviewer`, `tester`, plus `harness`, `verify`,
`docs`, `security`, and `omm-narration` (the wave-card templates).

Narration: during a run the model writes no text between waves, so
the commands put the wave header in each Workflow's name, which the
TUI shows at launch and on completion
(`Workflow(▶ Oleada 2/4 · implementación · implementer)`). The full
wave cards and `✅ Hecho` (real `git diff --stat` and literal test
output) come in the final message.

Experimental narration guardian (off by default): two hooks
(`omm-narrate-prompt` on `UserPromptSubmit`, `omm-narrate-stop` on
`Stop`, `plugin/hooks/narrate-*.mjs`, node builtins only, no network)
that block a turn end without a card. In Muse 1.4.0 a Stop block
issued while a Workflow runs in the background ends the run without a
model call, so the guardian produced no cards and is kept only for
experiments. Per-session state lives in `MUSE_PLUGIN_DATA_DIR`
(fallback `~/.local/state/oh-my-muse`), one file per session, pruned
past 7 days.

```sh
omm guard on      # off by default; status shows the switch
```

Notifications: the `omm-notify-stop` hook (`Stop`,
`plugin/hooks/notify.mjs`, self-contained, node builtins only) reads
**only** `$HOME/.config/oh-my-muse/notify.json` (`XDG_CONFIG_HOME` is
NOT used). It is silent unless that file sets a channel:

```sh
omm notify setup --channel file --file omm-notify.log \
  --message "turn done in {{projectName}}"
omm notify test   # send one notification using the file
```

Message templates support `{{projectName}}` (session cwd basename),
`{{event}}`, `{{date}}`, `{{model}}`, `{{sessionId}}`. With
`includeAssistantMessage: true` the turn's last assistant message is
appended (truncated to 500 chars, redacted).

Two warnings, both verified on this machine:

- Muse **filters the hook environment**: only `HOME`, `LANG`, `PATH`,
  etc. reach the hook — no `OMM_*`, no `XDG_CONFIG_HOME`. That is why
  secrets live in the file, never in env. For CLI use (`omm notify`)
  `OMM_*` variables still override the file.
- `Stop` fires at the end of **every turn** (also under `muse exec`),
  not once per session.

The file must stay owner-only (mode `0600`, directory `0700`):
`setup` writes it that way; a group/other-readable file makes the hook
send nothing and `omm doctor` fail. Telegram needs `botToken` +
`chatId`; Discord/Slack need `webhookUrl` (https + provider host
allowlist enforced; secrets redacted from every diagnostic and never
printed by `setup`/`doctor`). File-channel notes land inside the
payload `cwd` unless `allowExternalFile` is set. On-demand, without a
file:

```sh
omm notify --channel file --message "deploy done" --file ./notify.log
```

An explicit `--file` opts out of root confinement; file/env-driven
paths stay confined unless `allowExternalFile` /
`OMM_NOTIFY_ALLOW_EXTERNAL=1`. `omm doctor` reports the config file,
its mode, and its channel (never secrets).

## Uninstall

```sh
omm uninstall   # muse plugins remove oh-my-muse
```

## Development

```sh
npm test   # node --test test/ (validators skip cleanly when muse is absent)
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [CHANGELOG.md](CHANGELOG.md),
[docs/PARITY.md](docs/PARITY.md), [docs/OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md),
and [SECURITY.md](SECURITY.md).

## Benchmark: does omm add value over Muse Code?

Small games were not enough to tell whether omm helps, so it was tested on
a project of realistic complexity, to see whether its extra run time pays
off in quality.

Setup: a public website and management system for a fictitious psychology
practice (Laravel + Filament, SQLite). The public side has a blog, health
articles, services and a contact form that generates leads; the internal
panel has clients, leads and lead conversion, clinical records with private
attachments, 1:1 messaging and broadcast messages, and a calendar with
appointment requests; plus a patient portal. Both runs got the same
`SPEC.md`, on the same machine, with the same model, and a single attempt:
no feedback and no fixes, and anything that does not work end to end
counts as not delivered. The evaluation was blind (random codes) and done
by Claude Code with Playwright against a checklist of 37 tests and 91
points fixed in advance. The decision rule was also fixed before running:
omm adds value if it beats Muse Code without the plugin by at least 10
points and has no more security failures.

|                                                        | Muse Code | Muse Code + omm      |
| ------------------------------------------------------ | --------- | -------------------- |
| Time                                                   | 44 min    | 47 min               |
| Official score                                         | 39/91     | 0/91 (does not start) |
| Same test suite, app served without `artisan serve` (unofficial) | 39/91 | 34/91      |
| Flows that work, ignoring the external-resources rule  | 77/91     | 74/91                |
| Own tests                                              | 43/43     | 35/35                |
| Larastan level 5 errors                                | 25        | 26                   |

The omm run does not start on the evaluation machine: `php artisan serve`
drops the environment variables of the portable PHP install, so the server
returns a fatal error on every page. The Muse Code run detected and worked
around that problem; the omm run did not, even though it stated that it
had verified startup from a clean clone.

Both runs lose most of the admin and portal points for the same reason:
Filament's default avatar is loaded from `ui-avatars.com`, and the spec
forbade external resources. Both claimed "zero external requests".

Failures specific to the Muse Code run: the client selector stores the
wrong id, so clinical records, messages and appointments get assigned to
another patient (the most serious defect of the two). Failures specific to
the omm run: HTTP 500 when an attachment is requested without a session and
when an appointment is requested from the portal, and notifications are
not visible in the portal.

Conclusion: in this benchmark omm was neither faster nor better. At best
it comes close without surpassing it, at about 7 % more time, and its
verification phase missed failures it reported as checked. Under the rule
fixed in advance, omm does not add value.

Limitations: this is a single pair of runs (the protocol planned three per
side) and run-to-run variance is high, so the result does not show that
omm is worse; only that there is no evidence it helps, and that it costs
more. The spec, the checklist, the audit prompt and the reports are in
[docs/benchmark/](docs/benchmark/) for anyone who wants to repeat it.

## Attribution

Built for the Muse Spark ecosystem. This is a community project and is
**not affiliated with Meta**. "Muse" and "Muse Spark" model names belong
to their respective owners.

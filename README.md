# oh-my-muse

[![CI](https://github.com/jefalcon/oh-my-muse/actions/workflows/ci.yml/badge.svg)](https://github.com/jefalcon/oh-my-muse/actions/workflows/ci.yml)
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![ESM](https://img.shields.io/badge/modules-ESM-yellow)](package.json)

Native [Muse Code](https://github.com/anthropics/muse-code) plugin:
18 specialist skills, 7 orchestrator commands, and turn/session-end
notifications. No tiers, no presets, no model routing — the model is chosen
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
`docs`, `security`.

Notifications: the single `omm-notify-stop` hook (`Stop`,
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

## Attribution

Built for the Muse Spark ecosystem. This is a community project and is
**not affiliated with Meta**. "Muse" and "Muse Spark" model names belong
to their respective owners.

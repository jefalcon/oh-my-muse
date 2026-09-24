# oh-my-muse

[![CI](https://github.com/javi/oh-my-muse/actions/workflows/ci.yml/badge.svg)](https://github.com/javi/oh-my-muse/actions/workflows/ci.yml)
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![ESM](https://img.shields.io/badge/modules-ESM-yellow)](package.json)

Token-efficient agent pack runner for Muse Spark. Three literal tiers
(`budget` | `balanced` | `premium`), atomic installs, validated configs,
and redacted secrets.

## Install

Requires Node.js `>= 20` (ES modules).

```sh
git clone https://github.com/javi/oh-my-muse.git
cd oh-my-muse
node bin/omm.mjs --help
```

Use it in a project (paths are absolute; `--dir` defaults to cwd):

```sh
node /absolute/path/to/oh-my-muse/bin/omm.mjs setup --dir /absolute/path/to/project
node /absolute/path/to/oh-my-muse/bin/omm.mjs install --dir /absolute/path/to/project
node /absolute/path/to/oh-my-muse/bin/omm.mjs doctor --dir /absolute/path/to/project
```

Or link the binary once:

```sh
npm link
omm setup --dir /absolute/path/to/project
omm install --dir /absolute/path/to/project
```

## Examples

List configured agents with resolved tier and model:

```sh
omm list --dir /absolute/path/to/project
omm list --json --dir /absolute/path/to/project
```

Show or apply a model preset (`code`, `chat`, `reason`, plus custom ones
in `models.json`):

```sh
omm preset code --dir /absolute/path/to/project
omm preset reason --apply planner --dir /absolute/path/to/project
```

Read and change config (values support `$ENV` / `${VAR:-default}`):

```sh
omm config show --dir /absolute/path/to/project
omm config get defaultTier --dir /absolute/path/to/project
omm config set defaultTier premium --dir /absolute/path/to/project
```

Skills, notifications, and maintenance:

```sh
omm skill list --dir /absolute/path/to/project
omm notify --channel file --message "deploy done" --file /absolute/path/to/notify.log
omm update --dir /absolute/path/to/project
omm uninstall --dir /absolute/path/to/project
```

## Tiers

| Tier       | Model                | Use for             |
| ---------- | -------------------- | ------------------- |
| `budget`   | `muse-spark-fast`    | fast, low-cost chat |
| `balanced` | `muse-spark`         | general coding work |
| `premium`  | `muse-spark-reasoning` | deep reasoning    |

Details: [docs/MODES.md](docs/MODES.md),
[docs/MODEL-COMPATIBILITY.md](docs/MODEL-COMPATIBILITY.md),
[docs/PARITY.md](docs/PARITY.md).

## Development

```sh
npm run typecheck   # tsc --noEmit
npm test            # node --test test/
node test/smoke.mjs # agent shape validation
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [CHANGELOG.md](CHANGELOG.md),
and [SECURITY.md](SECURITY.md).

## Attribution

Built for the Muse Spark ecosystem. This is a community project and is
**not affiliated with Meta**. "Muse" and "Muse Spark" model names belong
to their respective owners; model availability and pricing are governed
by the provider, including OpenRouter-routed models.

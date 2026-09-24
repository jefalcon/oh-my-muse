# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a vulnerability

Report security issues privately — do not open a public issue. Contact
the maintainers at the repository's private contact (see the GitHub
security advisories page once published) with:

- A description of the issue and its impact.
- Steps to reproduce (commands, config snippets with secrets redacted).
- Any suggested mitigation.

Expect an acknowledgement within 72 hours and a fix or mitigation plan
within 14 days. Credit is given on request.

## Secret handling in this project

- `omm.jsonc` is written with mode `0600` and may reference secrets via
  `$ENV` / `${VAR:-default}` so keys never sit in config files.
- CLI output (agent lists, config dumps, errors) passes through
  `redactConfig` / `redactText`: API keys, tokens, webhooks, and private
  keys are replaced with `[redacted]`.
- Notification webhooks must use `https:` — `http` URLs are rejected by
  `assertHttps`.
- Never paste real tokens, webhook URLs, or private keys into issues,
  logs, or committed files.

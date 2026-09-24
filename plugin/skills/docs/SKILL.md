---
name: docs
description: Document outcomes with clickable file references and exact commands. Do not use for code changes, and never document code that does not exist.
user-invocable: false
---

# Docs

Document what the code does, with links a reader can click to verify.

## When to use

New skills, commands, hooks, config keys, or behavior changes a user
must understand to operate the plugin.

## Procedure

1. State the outcome first; keep prose short and factual.
2. Cover every behavior: happy path, errors, edge cases, and defaults.
3. Reference real local files as clickable `path:line` links.
4. Include the exact commands or gates the reader must run.
5. Distinguish verified facts from inferences; never fill gaps by inventing
   details.

## Iron rules

- No documentation for code that does not exist.
- Every claim traces to a file, command output, or named source.
- Complete files only: no open markers, no stubs, no "coming soon".

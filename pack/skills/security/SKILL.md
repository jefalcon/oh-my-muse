# Security Skill

Treat every input as untrusted until it is validated at the boundary.

## When to use

Any code that touches auth, secrets, user input, shell commands, file paths,
network output, or rendered HTML.

## Procedure

1. List the trust boundaries the change crosses (user input, env, network).
2. Validate at the boundary: allowlist values, bound lengths, reject the rest.
3. Never log, echo, or persist secrets; never interpolate untrusted input
   into shell, SQL, or HTML without the codebase's escaper.
4. Fail closed: unknown or ambiguous input is rejected, not passed through.
5. Name residual risks explicitly in the final report.

## Iron rules

- No secrets in code, logs, tests, or governor output.
- No `any`-typed passthrough of untrusted data across a boundary.
- An unrecognized value in a protective module is dropped or transformed,
  never passed through silently.

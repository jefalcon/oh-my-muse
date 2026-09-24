# Verify Skill

Prove the change works with the repository's own gates, not with assertions
about your own script.

## When to use

Before reporting any task done: after every edit, and after every
orchestrator wave that claims completion.

## Procedure

1. Find the configured gates first: package.json scripts, Makefile targets,
   CI workflow, tsconfig, and any lint/typecheck config.
2. Run the narrow gate for the touched area (typecheck, focused tests).
3. Run the full relevant test file or package unmodified; never narrow a run
   to exclude a failure.
4. Re-run your reproduction of the reported behavior against the real code.
5. Quote the observed command output; a clean-looking patch you never
   executed is not evidence.

## Iron rules

- An independent oracle decides: repo tests, golden files, or a second
  method. Your own script agreeing with itself proves nothing.
- A failing existing test is a requirement, not a stale artifact: fix the
  change, never delete or weaken the test.
- Never claim success you did not watch pass in this session.

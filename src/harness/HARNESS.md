# Harness Contract

The harness is the only path from steps to execution. Typed steps in,
verified waves out.

## Step shape

Each step carries `id`, `title`, and optionally `agent`, `files`, and
`verifyCommand`. Every orchestrator declares `spawnableAgents`, a closed
list: it may only schedule agents on that list.

## Wave semantics

`handleSteps(steps)` returns `{ waves, gate }`. A wave is `{ mode, steps,
note }` where `mode` is `parallel` or `sequence`.

- `parallel`: all steps in the wave may run concurrently.
- `sequence`: steps run strictly one at a time, in order.
- Waves run in order; a later wave never starts while an earlier wave is red.

## Gates

- muse-pipeline: `verifyCommand` exit 0 after every step.
- muse-ultraqa: zero failures across all checks.
- muse-team: reviewer verdict is approve.
- muse-ralph: single pass/fail check per loop iteration.
- muse-ralplan: critique-and-merge completes before execution.
- muse-advisor: reconciled decision cites all three advisors.
- muse-autopilot: driver owns the final diff.
- muse-deep-interview: spec complete before implementation.

## Anti-slop iron rules

1. Complete files only: no open markers, no stubs presented as done.
2. The oracle must be independent: repo tests, golden files, or a second
   method. Self-agreement proves nothing.
3. Never narrow a test run to exclude a failure; a red existing test is a
   requirement.
4. Never claim a result you did not watch occur in this session.
5. Tiers are the literal strings `budget`, `balanced`, `premium`; models
   resolve through `TIER_MODELS` and never override the tier contract.
6. Node >= 20, ESM only (`"type": "module"`); absolute paths in configs.

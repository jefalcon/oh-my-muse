---
description: Run a change with one driver owning it end to end plus supporting helpers
argument-hint: <change>
---

# OMM Autopilot

Run the requested change with a single driver owning it end to end: $ARGUMENTS

## Setup

1. Load the `workflow-authoring` skill and follow its Workflow API V1 profile.
   Subagents exist only inside the Workflow you author here.
2. Load the `harness` and `verify` skills and obey them for the whole run.
3. Use only these specialists: `implementer` (driver), `researcher`,
   `tester`, `debugger`, `docs-writer` (helpers). There are no tiers and no
   per-agent models; the session model does all the work.

## Wave plan

1. **Driver step**: exactly one driver (`implementer`) owns the change end
   to end and drives it to completion.
2. **Helper wave**: helpers (`researcher`, `tester`, `debugger`,
   `docs-writer`) support the driver in parallel and never take over the diff.

## Gate

The driver owns the final diff; helpers never commit over the driver. If
helpers disagree, the driver decides and records why. The driver integrates
helper outputs, verifies the result with the repository's own gates, and
reports done.

---
description: Advance work one unfinished step per loop iteration with a pass-fail check
argument-hint: <work>
---

# OMM Ralph

Advance the requested work in a single-check loop: $ARGUMENTS

## Setup

1. Load the `workflow-authoring` skill and follow its Workflow API V1 profile.
   Subagents exist only inside the Workflow you author here.
2. Load the `harness` and `verify` skills and obey them for the whole run.
3. Use only these specialists: `planner`, `implementer`, `tester`,
   `reviewer`, `debugger`. There are no tiers and no per-agent models; the
   session model does all the work.

## Wave plan

Pick the next unfinished step and run only that step. End the iteration with
one check: pass (advance) or fail (retry with a fix). Keep each iteration
small and self-contained; never batch multiple steps. Loop until every step
passes its check.

## Gate

One step per loop iteration; each iteration ends with a single pass/fail
check. The run is done only when every step has passed.

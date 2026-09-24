---
description: Run steps in strict sequence with a verify-command gate between steps
argument-hint: <work>
---

# OMM Pipeline

Run the requested work as a strict sequence, one step at a time: $ARGUMENTS

## Setup

1. Load the `workflow-authoring` skill and follow its Workflow API V1 profile.
   Subagents exist only inside the Workflow you author here.
2. Load the `harness` and `verify` skills and obey them for the whole run.
3. Use only these specialists: `planner`, `implementer`, `tester`,
   `reviewer`. There are no tiers and no per-agent models; the session model
   does all the work.

## Wave plan

Run steps in the given order, exactly one at a time. After every step, run
its `verifyCommand` (default: `npm test`) and require exit code 0 before
advancing. Never skip, reorder, or parallelize steps.

## Gate

Each step must end with `verifyCommand` exit 0; any nonzero exit blocks the
pipeline. Fix the step and re-verify before advancing.

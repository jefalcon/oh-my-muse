---
description: Run independent steps with maximum parallelism for wall-clock speed
argument-hint: <work>
---

# OMM Ultrawork

Run the requested work with maximum parallelism: $ARGUMENTS

## Setup

1. Load the `workflow-authoring` skill and follow its Workflow API V1 profile.
   Subagents exist only inside the Workflow you author here.
2. Load the `harness` and `verify` skills and obey them for the whole run.
3. Use only these specialists: `researcher`, `implementer`, `tester`,
   `refactorer`, `file-picker`, `docs-writer`. There are no tiers and no
   per-agent models; the session model does all the work.

## Wave plan

Run every independent step at once in a single parallel wave. Order steps
only when there is a true data dependency, and state what the dependency is.
Merge parallel results at the end and resolve conflicts explicitly. Optimize
for wall-clock time, not for step count.

## Gate

The run completes when every step reports done. Every step must still pass
the repository's own gates for its touched area before the run is reported
done.

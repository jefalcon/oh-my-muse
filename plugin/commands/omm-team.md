---
description: Run a goal with the default team orchestration (parallel research, serialized edits, reviewer loop)
argument-hint: <goal>
---

# OMM Team

Run the requested goal as an orchestrated team effort: $ARGUMENTS

## Setup

1. Load the `workflow-authoring` skill and follow its Workflow API V1 profile.
   Subagents exist only inside the Workflow you author here.
2. Load the `harness` and `verify` skills and obey them for the whole run.
3. Use only these specialists: `researcher`, `planner`, `implementer`,
   `tester`, `reviewer`, `critic`. There are no tiers and no per-agent models;
   the session model does all the work.

## Wave plan

Represent the goal as typed steps (id, title, agent, files, verifyCommand),
then run them in these waves:

1. **Parallel research**: all read-only steps (`researcher`, or steps with no
   agent assigned) run together.
2. **Serialized same-file edits**: steps touching the same files run in order,
   one group per distinct file set, never in parallel.
3. **File-independent writes**: steps with no files, or disjoint file sets,
   run in parallel.
4. **Reviewer loop**: send the resulting diff to `reviewer` and fix blocking
   findings until the verdict is `approve`.

## Gate

`reviewer` must approve, and same-file edits must never run in parallel.
Never report done while reviewer findings are open. Prove every wave with
the repository's own gates before finishing.

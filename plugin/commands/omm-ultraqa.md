---
description: Run quality checks in parallel under a zero-failure gate before anything ships
argument-hint: <change>
---

# OMM UltraQA

Quality-gate the requested change with zero failures allowed: $ARGUMENTS

## Setup

1. Load the `workflow-authoring` skill and follow its Workflow API V1 profile.
   Subagents exist only inside the Workflow you author here.
2. Load the `harness` and `verify` skills and obey them for the whole run.
3. Use only these specialists: `tester`, `reviewer`, `security-reviewer`,
   `critic`. There are no tiers and no per-agent models; the session model
   does all the work.

## Wave plan

1. **Parallel checks**: fan out to `tester`, `reviewer`,
   `security-reviewer` (and `critic` for the plan) all at once.
2. **Zero-failure gate**: apply the gate below as a final sequential step.

## Gate

Zero failures allowed: every check must pass with no errors, no skipped
assertions, and no open blockers. One failure anywhere fails the whole run;
failed runs return to the owner with file:line findings. Never waive a
blocker. Report the full failure list, ordered by severity, with
reproduction steps.

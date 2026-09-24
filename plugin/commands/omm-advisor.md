---
description: Reconcile three independent advisor views into one evidenced decision
argument-hint: <question>
---

# OMM Advisor

Answer the requested question with three independent advisors reconciled
into one decision: $ARGUMENTS

## Setup

1. Load the `workflow-authoring` skill and follow its Workflow API V1 profile.
   Subagents exist only inside the Workflow you author here.
2. Load the `harness` and `verify` skills and obey them for the whole run.
3. Use only these specialists: `architect`, `critic`, `security-reviewer`
   (advisors), `planner` (reconciler). There are no tiers and no per-agent
   models; the session model does all the work.

## Wave plan

1. **Independent advisors**: consult exactly three advisors independently
   (`architect`, `critic`, `security-reviewer`). Advisors must not see each
   other's output before writing their own.
2. **Reconcile**: `planner` merges the three outputs afterwards — keep what
   they agree on, resolve disagreements with evidence from the repository,
   and record any remaining dissent explicitly.

## Gate

The reconciled decision must cite each advisor and resolve every
disagreement. Never present a single advisor's view as the consensus.

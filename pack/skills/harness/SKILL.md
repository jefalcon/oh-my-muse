# Harness Skill

Run work through the harness contract: typed steps in, verified waves out.

## When to use

Whenever an orchestrator runs steps: team, pipeline, ralph, ultraqa,
ultrawork, ralplan, advisor, autopilot, or deep-interview flows.

## Procedure

1. Represent work as typed steps: id, title, agent, files, verifyCommand.
2. Route steps through the orchestrator's `handleSteps`: it returns waves of
   `parallel` or `sequence` plus a gate condition.
3. Execute waves in order; respect `sequence` strictly.
4. Apply the gate: pipeline needs verifyCommand exit 0, ultraqa needs zero
   failures, team needs reviewer approval.
5. Report the gate result with observed output, not a summary of intent.

## Iron rules

- Never execute a step the harness did not schedule.
- Never mark a wave done while its gate is red.
- `spawnableAgents` is a closed list: only spawn agents it names.

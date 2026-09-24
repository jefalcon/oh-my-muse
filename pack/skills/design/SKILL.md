# Design Skill

Produce the smallest design that satisfies the constraints, with trade-offs
stated explicitly.

## When to use

Before implementing anything with more than one reasonable shape: new
modules, interfaces, data models, or cross-file refactors.

## Procedure

1. Read the callers, types, and existing tests for the area; they encode the
   real contract.
2. Write goals, constraints, proposed structure, interfaces, and risks.
3. Name at least one alternative and why it was rejected.
4. Define ownership per component: what it owns, exposes, and must not do.
5. Mirror sibling code: same types, keys, constructors, and error shapes.

## Iron rules

- Smallest sufficient design; no speculative generality.
- Every interface names its errors, edge cases, and empty-state behavior.
- No new abstraction without two call sites or an explicit exception.

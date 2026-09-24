# TDD Skill

Write the failing test first, then the smallest implementation that passes it.

## When to use

Every behavior change, bug fix, or new feature. No production code without a
red test that reproduces the requirement.

## Procedure

1. Restate the requirement as one observable behavior.
2. Add or update a test that fails for exactly that reason; run it and read
   the failure output.
3. Implement the smallest change that turns the test green.
4. Refactor while keeping the suite green; run the full affected test file.
5. For bug fixes, keep the regression test that failed before the fix.

## Iron rules

- Never write implementation before its test exists and fails.
- One behavior per test; name the test after the behavior.
- No commented-out tests, no skipped tests to force a green run.
- Real assertions only: no tests that pass without exercising the code.

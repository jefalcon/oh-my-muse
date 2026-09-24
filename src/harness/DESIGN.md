# Design Rules

Smallest sufficient design, stated trade-offs, verified behavior.

## Rules

1. Derive the contract from the repo: callers, types, and existing tests
   outrank any summary. Match sibling shapes; reuse helpers.
2. One behavior per unit; every unit names its errors, edge cases, empty
   states, and defaults.
3. No speculative generality: no new abstraction without two call sites.
4. State the rejected alternative and why it lost.
5. Concurrency is explicit: parallel only with no shared mutable state;
   same-file edits are serialized.
6. Fail closed on protective paths: unknown input is rejected, never passed
   through.

## Anti-slop iron rules

1. No open task markers or stub text in shipped files.
2. No dead code, no commented-out blocks, no unused exports kept "just in
   case".
3. No invented APIs: every import, command, and config key must resolve in
   the repo or its declared dependencies.
4. No long chain-of-thought in comments; comments state the why in one line.
5. Findings first, evidence second: every claim cites a file, a command
   output, or a named source; gaps are labeled unresolved, never papered
   over.
6. Done means the repo's own gates pass unmodified in this session.

# Open Questions (oh-my-muse 0.2.0)

Gaps found while converting to a native Muse Code plugin. Anything not in
`docs/muse-recon/recon1-3.txt` or the exported MSP schema is treated as
nonexistent; items below record what was missing and the decision taken.

## Decided

### D1 — No on-disk `workflow.js` launcher (Fase 2, decided 2026-09-24)

The exported MSP schema (`muse schema generate-ts`, stable and
experimental surfaces) contains **no workflow-launch method**: `MspMethod`
lists `workflow/cancel` and `workflow/childControl` but no launch entry,
and `resumeFromRunId` is a field on transcript `Item`s for resumed
launches, not a tool input. Workflow runs observed in practice carry
`triggerSource: "modelProposal"`: the model proposes the workflow inline
and the runtime reconciles it.

Therefore no script on disk (e.g. `skills/omm-<n>/workflow.js`) can launch
a workflow by itself. Each `omm-*` command instead orders the model to
load the `workflow-authoring` skill and author the workflow inline
following the orchestrator's wave plan and gate, written out in prose in
the command body. If a future Muse version documents a script-file launch
entry, revisit: add `skills/omm-<n>/workflow.js` (Workflow API V1) plus a
launcher command.

### D2 — Notify hook event (Fase 3, decided 2026-09-24)

The recon stated only `PreToolUse` as confirmed. Probing
`muse plugins validate --json` with a throwaway plugin in `.scratch/`
(not installed) showed these exact, case-sensitive events validate clean:
`PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Stop`,
`UserPromptSubmit`, `Notification`, `PermissionRequest`, `SessionStart`,
`SessionEnd`, `PreCompact`, `SubagentStart`, `SubagentStop`.
Rejected: `TurnEnd`, `SessionEndBlahBlah` (invented), any case variant
(`stop`, `sessionend`, `pretooluse`), and `PreToolUseV2`.
(`SessionStart` also validates, but it is a start event, not an end event.)

`Stop` (end of turn) and `SessionEnd` (end of session) both exist, so the
notify hook is registered on both, sharing one `hooks/notify.mjs` source
(one source file per hook ID is required; here each hook ID keeps its own
argv entry pointing at the same file — see D3).

### D3 — Hook source sharing (Fase 3, decided 2026-09-24)

The contract states hook source paths cannot be shared by two hook IDs.
`omm-notify-stop` and `omm-notify-end` both execute
`["node", "hooks/notify.mjs"]` with different behavior selected from the
hook payload's event name at runtime, so a single argv path is referenced
twice. If the validator rejects the shared path, the fallback is to split
into `hooks/notify-stop.mjs` + `hooks/notify-end.mjs` (thin wrappers).
Kept as one file unless validation says otherwise.

## Open

### O1 — Hook stdin payload shape

No recon source documents the JSON payload a hook receives on stdin, nor
the expected stdout/exit-code protocol beyond "structured argv, not a
shell string". `plugin/hooks/notify.mjs` therefore reads stdin leniently
(any JSON or empty), never fails the hook on malformed input (exits 0
after logging redacted diagnostics to stderr), and caps its own runtime
well under `timeoutMs`. `muse plugins hook test` could confirm the shape
but requires an installed plugin, which is out of scope here.

### O2 — Command frontmatter beyond `description`/`argument-hint`

`capability-examples.json` shows only `description` + `argument-hint` for
commands. No source enumerates further allowed keys, so commands carry
exactly those two. If the validator later accepts more (e.g. a
`user-invocable` equivalent), revisit.

### O3 — Model choice lives in `settings.json`

There are no tiers, presets, `models.json`, or OpenRouter routing in the
plugin. The model is chosen per session (`muse --model <id>` or
`settings.json`). The tier-driven `muse exec` wrapper is deferred to a
later version (README notes this).

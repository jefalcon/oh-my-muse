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
notify hook was registered on both, sharing one `hooks/notify.mjs` source
(one source file per hook ID is required; each hook ID kept its own
argv entry pointing at the same file — see D3).

Fase 5 update: a probe plugin showed `Stop` fires at the end of EVERY
turn (also under `muse exec`) and the hook environment is filtered (no
`OMM_*`, no `XDG_CONFIG_HOME` reach the hook). The `SessionEnd`
registration is therefore removed: a single `omm-notify-stop` hook on
`Stop` remains, reading only `$HOME/.config/oh-my-muse/notify.json`.

### D3 — Hook source sharing (Fase 3, decided 2026-09-24)

The contract states hook source paths cannot be shared by two hook IDs.
`omm-notify-stop` and `omm-notify-end` needed the same logic, but the
validator rejects a shared argv source (`duplicate-hook-source`, observed
2026-09-24). Applied the fallback: `hooks/notify.mjs` holds all shared
logic (exported `runHook`), and thin wrappers `hooks/notify-stop.mjs` /
`hooks/notify-end.mjs` reference one argv path each. Validation is clean.

Fase 5 update: with only one hook left there is no sharing anymore, so
`omm-notify-stop` points directly at `hooks/notify.mjs` and both
wrappers are deleted.

## Open

### O1 — Hook stdin payload shape (Fase 5: verified on this machine)

A probe `Stop` hook under `muse exec` received this environment (only):
`HOME`, `LANG`, `LOGNAME`, `PATH`, `SHELL`, `TERM`, `USER`,
`MUSE_PLUGIN_ROOT`, `MUSE_PLUGIN_DATA_DIR`, `MUSE_PLUGIN_ID`,
`PLUGIN_ROOT`, `PLUGIN_DATA`, `CLAUDE_PLUGIN_ROOT`,
`CLAUDE_PLUGIN_DATA` — no `OMM_*`, no `XDG_CONFIG_HOME`. cwd is the
workspace root and stdin JSON carries `cwd`, `hook_event_name`
(`"Stop"`), `last_assistant_message`, `model`, `model_provider`,
`permission_mode`, `session_id`, `stop_hook_active`, `transcript_path`,
`turn_id`. `plugin/hooks/notify.mjs` parses that shape tolerantly
(non-object input is a silent no-op), never fails the turn (always exit
0 after redacted stderr diagnostics), and caps its own runtime well
under `timeoutMs`.

### O4 — Do webhooks leave the hook network sandbox? (Resolved 2026-09-24)

2026-09-24: un hook Stop alcanzó api.telegram.org y discord.com (HTTP
200) con el sandbox activo. Los webhooks sí salen del sandbox de red
del hook.

(Resto del contexto original: el canal `file` funciona sin red. Se
verificó con `omm notify setup --channel discord ...` + `omm notify
test` (CLI, entorno completo) frente a un `Stop` real, comparando
llegadas.)

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

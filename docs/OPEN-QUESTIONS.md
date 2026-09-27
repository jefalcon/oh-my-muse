# Open Questions (oh-my-muse 0.2.0)

Gaps found while converting to a native Muse Code plugin. Anything not in
the maintainer's local evidence (Muse Code 1.3.0 recon, unpublished) or the
exported MSP schema is treated as nonexistent; items below record what was
missing and the decision taken.

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

## Decided (0.2.1)

### D4 — Readable workflow names: per-child only (decided 2026-09-24; superseded by D11)

Regenerated `muse schema generate-ts --out .scratch/msp` on Muse Code
1.3.0: `MspMethod` still carries only `workflow/cancel` and
`workflow/childControl` (no launch entry — confirms D1), and a
`workflow` transcript item carries only runtime-assigned opaque
identity (`entryId`, `scriptId`, `workflowRunId`, `triggerSource`
e.g. `"modelProposal"`). There is NO model-settable run name/title
field: names like `generated.model-chosen` are runtime-generated.
The only readable knob with a durable surface is per child:
`WorkflowChild` folds optional `label` and `phase` ("when recorded"),
so a child call may carry `label` / `phase("…")` (e.g. `w2-implementer`).
Whether the TUI renders them was not verifiable from this session —
the guaranteed-visible narration is the parent's cards (skill
`omm-narration`), never the run name.

## Decided (0.2.2)

### D7 — Narration must be enforced by a Stop hook (decided 2026-09-27; superseded by D10)

Verified with real probes: the model does not narrate between waves
even when ordered to. The tool is called `workflow`, runs in the
background, and every launch ends the parent's turn (a `Stop` event
right after). The parent wakes up with the results — no
`UserPromptSubmit` — and launches the next wave without writing text.
With the skill registered, only the final message of the whole run
followed the template (`✔ Oleada 4/4` + `✅ Hecho`). Neither "write
before calling" nor "write when closing the turn" worked, so 0.2.1's
planned `PostToolUse` enforcement was dropped in favour of a blocking
`Stop` hook (`omm-narrate-stop`), armed per session by
`omm-narrate-prompt` on `UserPromptSubmit`.

### D8 — Blocking a Stop: `decision:block` on stdout (decided 2026-09-27)

`muse plugins hook test` confirms: stdout
`{"decision":"block","reason":"…"}` with exit 0 yields `should_block:
true` with `block_reason` set; exit 2 with the reason on stderr works
too. `hookSpecificOutput` carrying `decision` errors on `Stop`: never
use it there. The guardian uses the stdout form with exit 0.

### D9 — `additionalContext` does not surface (decided 2026-09-27)

`additionalContext` on `PostToolUse` fills `additional_contexts` in
`hook test`, but in a real run the mark appeared in no session log.
Nothing depends on it; the guardian returns no context additions.

### D10 — A Stop block does not reactivate the model while a workflow runs (decided 2026-09-27)

Session `01a0e4a9-6563-77c1-a979-219054750bd2` (two `/omm-team` runs,
guardian on, 8 blocks). Every block follows the same pattern
(analyzer lines 278, 400, 495, 588, 885, 1002, 1088, 1193):
`workflow_run_launched` → `hook_run_terminal` (`omm-narrate-stop`,
`status: blocked`, `effects: ["blocked"]`) → `completed` →
`runtime.session/terminal` (`terminal: completed`, `reason: null`),
all in the same `run_id` and within about 25 ms. No
`model_request_configured` or `model_response_created` sits between
the block and `terminal`, and the reason text ("Guardián omm: …")
appears 0 times in the whole log, including later model inputs. The
next model call is a new `run_id`, started by `inbox_item_queued`
with `source: background_task_terminal` when the workflow ends. So the
runtime does not honor the block while a background workflow is
pending. The guardian is kept, off by default (`omm guard on`), for
future Muse versions.

### D11 — Workflow names are display-only and free text (decided 2026-09-27)

The `workflow` tool's `name` is described as "Required short
human-readable name, such as Summarize library functions … When
script or scriptPath is present, name is display-only". The
`^[a-z0-9][a-z0-9._-]{0,79}$` pattern applies only to saved workflows
(`muse workflows save`). Probe session `01a0e4cf`: names
`▶ Oleada 1/2 · prueba · researcher` and `▶ Oleada 2/2 · cierre ·
writer` were accepted verbatim (`entry_id`); `script_id` becomes a
sanitized `generated.workflow.__Oleada_1_2___prueba___researcher`.
The TUI shows the name at launch and on completion, so the wave header
lives there (all 7 commands, `omm-narration`). Confirmed in a real
headless `/omm-team` run (session `01a0e4d4`, 4 waves, about 6 min):
the model named every wave `▶ Oleada N/4 · <nombre> · <rol>`, the log
records it as `entryId`, `display_label` and "Launched ▶ Oleada …", and
the final message carried the four wave cards plus `✅ Hecho` with a
real `git diff --stat` and literal test output (89/89). The opening
`🏮 OMM` card was not written.

### D12 — `muse exec` does not expand plugin slash commands (decided 2026-09-27)

`muse exec "/omm-team <task>"` sends the literal text: the model
worked in the main thread (bash, read_file, search) with no
`read_skill bundled:workflow-authoring` and no workflow. Headless
smoke runs pass the command body with `$ARGUMENTS` substituted
(`--prompt-file`) plus `--trust-workspace` (otherwise `AGENTS.md` is
skipped). `muse exec` does wait for background workflows before it
exits.

## Open

### O6 — Revalidación en Muse Code 1.4.0 (verificado 2026-09-27)

Revalidados los 19 skills (`muse skills validate --json`) y el plugin
(`muse plugins validate plugin --json`) con Muse Code 1.4.0:
`valid:true`, cero diagnósticos en todos. Sin cambios respecto a
1.3.0 en el comportamiento de los validadores ni en el formato de
`muse skills list --json` (`{skills: [{id, ...}]}`, ids
`plugin:oh-my-muse:*` cuando el plugin está instalado).

### O5 — Is `log()` visible in the TUI or /workflows? (unverified)

`bundled:workflow-authoring` documents the bare global `log("message")`
(progress markers, max 512 chars) and `phase("title")` (max 128 chars),
but neither the skill nor the MSP schema (no log-message field on any
item or view) says where — if anywhere — that output renders. It could
not be observed from this session. Consequence: children MAY emit
`[<rol>] <acción>` log lines at milestones, but the narration contract
never depends on them being seen; the parent's wave cards are the
surface the user is guaranteed to see.

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

2026-09-27 re-verification (0.2.2): the `Stop` payload carries `cwd`,
`hook_event_name`, `last_assistant_message`, `model`,
`model_provider`, `permission_mode`, `session_id`,
`stop_hook_active`, `turn_id`; the `UserPromptSubmit` payload carries
`cwd`, `hook_event_name`, `model`, `model_provider`,
`permission_mode`, `prompt`, `session_id`, `transcript_path`. The
narrate hooks parse both shapes tolerantly with the same
never-fail-the-turn policy.

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

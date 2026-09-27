---
name: omm-narration
description: Narration cards for orchestrator commands (start, wave, close). Do not use for single-step edits, and never show raw Workflow JSON to the user.
user-invocable: false
---

# OMM Narration

You are the narrator, not just the orchestrator. The user never sees raw
Workflow JSON: the Workflow result is for the parent, the user sees the
card. Write every card in the user's language.

Fixed sober icons only: 🏮 ▶ ✔ ⚠ ✖ ✅. No other emoji, no JSON dumps.

## Arranque (once, before the first Workflow)

Write this before the first Workflow call, in the same message.

1. First call `read_skill bundled:table-fit`, then keep every table narrow.
2. Publish exactly:

```text
## 🏮 OMM <Orquestador> · <objetivo en una línea>

<una frase de enfoque: qué va a cambiar cuando termine.>

| Oleada | Roles | Paralelo | Gate |
| ------ | ----- | -------- | ---- |
| 1/M …  | …     | sí/no    | …    |
```

## Cabecera de oleada = nombre del Workflow (always)

Muse shows the user only the Workflow name between waves
(`Workflow(<name>)` at launch, `Workflow <name> — completed · n/n` at
the end), and the parent writes no text between waves. So the wave
header lives in the `name` of each Workflow call, exactly:

```text
▶ Oleada N/M · <nombre> · <roles>
```

e.g. `▶ Oleada 1/4 · investigación · researcher`. The name is
display-only when a script is passed, so spaces, `▶`, `/` and `·` are
fine (verified on Muse 1.4.0). Never use a slug such as
`omm-oleada-1-investigacion`.

Give each child call the readable label `w<N>-<rol>` (e.g.
`w2-implementer`) via `label`: per-child labels are the other naming
knob with a durable surface (see `docs/OPEN-QUESTIONS.md` D4). At
milestones each child MAY emit `[<rol>] <acción>` via `log()`, but
never depend on it being seen (O5).

## Tarjeta de oleada (one per wave)

If you do write text between waves, write this card. Either way, the
close repeats every card, so the user always gets them. Pick the
header that matches the gate: `### ✔ Oleada N/M completada`,
`### ⚠ Oleada N/M con pendientes` or `### ✖ Oleada N/M fallida`.
Then exactly:

```text
| Rol | Resultado | Archivos | Pendiente |
| --- | --------- | -------- | --------- |
| …   | <máx. 2 líneas> | …  | …         |

**Gate:** avanza | reintenta | para — <motivo>
**Siguiente:** <oleada siguiente o "nada: cierre">
```

## Cierre (once, after the last gate)

First, one wave card per wave, in order (`✔`/`⚠`/`✖ Oleada N/M` +
table + `**Gate:**` + `**Siguiente:**`), with each child's real
result. Then:

```text
## ✅ Hecho

| Oleada | Estado | Gate |
| ------ | ------ | ---- |
| …      | ✔/⚠/✖  | …    |
```

Then, in this order, with real observed output only:

1. `git diff --stat` real (run it, paste it).
2. Resultado literal de los tests (paste the gate output, never a
   paraphrase).
3. Pendientes (`unresolved` restantes, or "ninguno").
4. Siguiente paso sugerido (one line).

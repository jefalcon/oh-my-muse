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

1. First call `read_skill bundled:table-fit`, then keep every table narrow.
2. Publish exactly:

```text
## 🏮 OMM <Orquestador> · <objetivo en una línea>

<una frase de enfoque: qué va a cambiar cuando termine.>

| Oleada | Roles | Paralelo | Gate |
| ------ | ----- | -------- | ---- |
| 1/M …  | …     | sí/no    | …    |
```

## Antes de cada oleada (always, right before launching its Workflow)

```text
### ▶ Oleada N/M · <nombre>

<una línea con el porqué de esta oleada ahora.>

- <rol> → <encargo en una línea>
```

Give each child call the readable label `w<N>-<rol>` (e.g.
`w2-implementer`) via `label` / `phase("…")`: per-child labels are the
only naming knob with a durable surface (see `docs/OPEN-QUESTIONS.md`
D4). At milestones each child MAY emit `[<rol>] <acción>` via `log()`,
but never depend on it being seen (O5): the cards are the guaranteed
surface.

## Tras cada oleada (always, before launching the next Workflow)

Pick the header that matches the gate: `### ✔ Oleada N/M completada`,
`### ⚠ Oleada N/M con pendientes` or `### ✖ Oleada N/M fallida`.
Then exactly:

```text
| Rol | Resultado | Archivos | Pendiente |
| --- | --------- | -------- | --------- |
| …   | <máx. 2 líneas> | …  | …         |

**Gate:** avanza | reintenta | para — <motivo>
**Siguiente:** <oleada siguiente o "nada: cierre">
```

Hard rule: PROHIBIDO lanzar el siguiente Workflow sin haber escrito
antes esta tarjeta y la cabecera `▶` de la siguiente oleada.

## Cierre (once, after the last gate)

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

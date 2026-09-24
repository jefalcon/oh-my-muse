---
description: Run a change with one driver owning it end to end plus supporting helpers
argument-hint: <change>
---

# OMM Autopilot

Ejecuta el cambio con un único conductor responsable de principio a
fin: $ARGUMENTS

## Reglas de orquestación (obligatorias)

1. DEBES empezar llamando a `read_skill bundled:workflow-authoring` y
   seguir su perfil Workflow API V1 con el esquema
   `complete/evidence/unresolved`. Sin esta lectura no hay oleadas.
   Tras esa lectura, OBLIGATORIO: `read_skill
   plugin:oh-my-muse:omm-narration` y obedecer sus cuatro plantillas
   (arranque, cabecera de oleada, tarjeta de oleada, cierre) en el
   idioma del usuario.
2. DEBES orquestar con la herramienta Workflow. PROHIBIDO implementar,
   investigar o editar en el hilo principal: el hilo principal solo
   anuncia el plan, lanza Workflows, narra entre oleadas e integra el
   resultado al final.
3. Si la herramienta Workflow no está disponible en tu sesión, DEBES
   decirlo explícitamente ("Workflow no disponible: paro sin ejecutar")
   y parar. PROHIBIDO seguir en silencio en el hilo principal.
4. Un Workflow por oleada: DEBES lanzar una llamada a la herramienta
   Workflow POR CADA oleada del plan (nunca un único Workflow para
   todo). Un Workflow solo devuelve su resultado al terminar y el padre
   no puede narrar mientras se ejecuta; entre oleadas, narra el
   progreso.
5. PROHIBIDO encadenar dos llamadas a Workflow sin haber escrito antes
   la tarjeta de fin de oleada (`✔`/`⚠`/`✖` + `**Gate:**` +
   `**Siguiente:**`) y la cabecera `▶` de la siguiente oleada. La
   narración va en el hilo principal: el resultado del Workflow es
   para el padre, el usuario ve la tarjeta.

## Contrato de progreso (visible para el usuario)

- Antes de lanzar: publica el plan con las oleadas, los roles de cada
  oleada y el gate de cada una.
- Tras cada oleada: por cada hijo informa rol + hallazgos clave (2-3
  líneas) + archivos tocados + `unresolved`. Después anuncia la
  decisión del gate (avanza / reintenta / para).
- Al final: informe con qué se hizo, verificación (gates del repo) y
  pendientes (`unresolved` restantes).

## Forma de cada `input` (obligatoria)

- El `input` de cada hijo DEBE empezar con "Primero llama a read_skill plugin:oh-my-muse:<rol>." (sustituye `<rol>` por el rol de ese hijo:
  `implementer` conductor, `researcher`, `tester`, `debugger`,
  `docs-writer` ayudantes) y pedir el esquema
  `complete/evidence/unresolved/summary/files/decisions`
  (`complete:boolean`, `evidence:string[]`, `unresolved:string[]`,
  `summary:string` — máx. 2 líneas, `files:string[]`,
  `decisions:string[]`).
- Cada `input` completo DEBE respetar el límite de 4096 bytes UTF-8
  (texto + refs + contexto compacto + `summary`/`files`/`decisions`
  juntos).
- Cada llamada de hijo lleva `label: "w<N>-<rol>"` (p. ej.
  `w2-implementer`).

## Setup

Usa solo estos especialistas: `implementer` (conductor), `researcher`,
`tester`, `debugger`, `docs-writer` (ayudantes). No hay niveles ni
modelos por agente; el modelo de la sesión hace todo el trabajo. Carga
además las skills `harness` y `verify` y obedécelas durante toda la
ejecución.

## Oleadas

Un único conductor (`implementer`) es dueño del cambio de principio a
fin. Ejecuta estas oleadas, una llamada a Workflow por oleada:

1. **Ayudantes investigan**: `researcher` (y `debugger` si hay un fallo
   que reproducir) trabajan en paralelo en un Workflow y devuelven
   evidencia al conductor. No tocan el diff.
2. **El conductor implementa**: un Workflow con el `implementer` que
   aplica el cambio de principio a fin.
3. **Ayudantes verifican**: `tester`, `debugger` y `docs-writer` en
   paralelo en un Workflow; el conductor integra sus salidas en el
   diff final, verifica con los gates propios del repo e informa.

## Gate

El conductor es dueño del diff final; los ayudantes nunca escriben
sobre él. Si los ayudantes discrepan, el conductor decide y registra
por qué.

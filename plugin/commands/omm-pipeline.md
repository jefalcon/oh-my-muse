---
description: Run steps in strict sequence with a verify-command gate between steps
argument-hint: <work>
---

# OMM Pipeline

Ejecuta el trabajo en secuencia estricta, un paso cada vez: $ARGUMENTS

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
  `planner`, `implementer`, `tester`, `reviewer`) y pedir el esquema
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

Usa solo estos especialistas: `planner`, `implementer`, `tester`,
`reviewer`. No hay niveles ni modelos por agente; el modelo de la
sesión hace todo el trabajo. Carga además las skills `harness` y
`verify` y obedécelas durante toda la ejecución.

## Oleadas

Cada paso es una oleada: un Workflow por paso, en el orden dado, de
uno en uno. Nunca saltes, reordenes ni paralelices pasos. Tras cada
oleada ejecuta su `verifyCommand` (por defecto `npm test`) y exige
código de salida 0 antes de avanzar. Narra el progreso entre oleadas.

## Gate

Cada paso debe terminar con `verifyCommand` en 0; cualquier salida no
cero bloquea el pipeline. Corrige el paso y re-verifica antes de
avanzar.

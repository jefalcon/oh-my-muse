---
description: Run independent steps with maximum parallelism for wall-clock speed
argument-hint: <work>
---

# OMM Ultrawork

Ejecuta el trabajo con el máximo paralelismo: $ARGUMENTS

## Reglas de orquestación (obligatorias)

1. DEBES empezar llamando a `read_skill bundled:workflow-authoring` y
   seguir su perfil Workflow API V1 con el esquema
   `complete/evidence/unresolved`. Sin esta lectura no hay oleadas.
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
  `researcher`, `implementer`, `tester`, `refactorer`, `file-picker`,
  `docs-writer`) y pedir el esquema `complete/evidence/unresolved`
  (`complete:boolean`, `evidence:string[]`, `unresolved:string[]`).
- Cada `input` completo DEBE respetar el límite de 4096 bytes UTF-8
  (texto + refs + contexto compacto juntos).

## Setup

Usa solo estos especialistas: `researcher`, `implementer`, `tester`,
`refactorer`, `file-picker`, `docs-writer`. No hay niveles ni modelos
por agente; el modelo de la sesión hace todo el trabajo. Carga además
las skills `harness` y `verify` y obedécelas durante toda la ejecución.

## Oleadas

Optimiza el tiempo de reloj, no el número de pasos. Una llamada a
Workflow por oleada:

1. **Oleada paralela**: todos los pasos independientes a la vez en un
   Workflow. Ordena pasos solo ante una dependencia real de datos, y
   di cuál es.
2. **Oleada de dependientes** (solo si la 1 declaró dependencias):
   los pasos que esperaban datos de la oleada 1, en un Workflow.
   Fusiona los resultados paralelos al final y resuelve los conflictos
   explícitamente.

## Gate

La ejecución termina cuando todos los pasos informan hecho. Cada paso
debe pasar los gates propios del repo de su área antes de informar
hecho.

---
description: Run a goal with the default team orchestration (parallel research, serialized edits, reviewer loop)
argument-hint: <goal>
---

# OMM Team

Ejecuta el objetivo como un equipo orquestado: $ARGUMENTS

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
  `researcher`, `planner`, `implementer`, `tester`, `reviewer`,
  `critic`) y pedir el esquema `complete/evidence/unresolved`
  (`complete:boolean`, `evidence:string[]`, `unresolved:string[]`).
- Cada `input` completo DEBE respetar el límite de 4096 bytes UTF-8
  (texto + refs + contexto compacto juntos).

## Setup

Usa solo estos especialistas: `researcher`, `planner`, `implementer`,
`tester`, `reviewer`, `critic`. No hay niveles ni modelos por agente;
el modelo de la sesión hace todo el trabajo. Carga además las skills
`harness` y `verify` y obedécelas durante toda la ejecución.

## Oleadas

Representa el objetivo como pasos tipados (id, título, agente,
archivos, verifyCommand) y ejecútalos en estas oleadas, una llamada a
Workflow por oleada:

1. **Investigación paralela**: todos los pasos de solo lectura
   (`researcher`, o pasos sin agente asignado) juntos en un Workflow.
2. **Ediciones del mismo archivo, en serie**: los pasos que tocan los
   mismos archivos van en orden, un Workflow por grupo de archivos.
   Nunca en paralelo.
3. **Escrituras independientes**: pasos sin archivos o con archivos
   disjuntos, en paralelo en un Workflow.
4. **Bucle de revisión**: un Workflow por iteración que envía el diff
   a `reviewer`; corrige los hallazgos bloqueantes hasta que el
   veredicto sea `approve`.

## Gate

`reviewer` debe aprobar, y las ediciones del mismo archivo nunca van en
paralelo. Nunca informes "hecho" con hallazgos abiertos. Demuestra cada
oleada con los gates propios del repo antes de terminar.

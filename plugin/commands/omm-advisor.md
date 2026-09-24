---
description: Reconcile three independent advisor views into one evidenced decision
argument-hint: <question>
---

# OMM Advisor

Responde la pregunta con tres asesores independientes reconciliados en
una decisión: $ARGUMENTS

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
  `architect`, `critic`, `security-reviewer` asesores, `planner`
  reconciliador) y pedir el esquema `complete/evidence/unresolved`
  (`complete:boolean`, `evidence:string[]`, `unresolved:string[]`).
- Cada `input` completo DEBE respetar el límite de 4096 bytes UTF-8
  (texto + refs + contexto compacto juntos).

## Setup

Usa solo estos especialistas: `architect`, `critic`,
`security-reviewer` (asesores), `planner` (reconciliador). No hay
niveles ni modelos por agente; el modelo de la sesión hace todo el
trabajo. Carga además las skills `harness` y `verify` y obedécelas
durante toda la ejecución.

## Oleadas

Una llamada a Workflow por oleada:

1. **Asesores independientes**: consulta exactamente a tres asesores
   (`architect`, `critic`, `security-reviewer`) en un Workflow. Los
   asesores no deben ver la salida de los otros antes de escribir la
   suya.
2. **Reconciliación**: `planner` fusiona las tres salidas en un
   segundo Workflow — conserva lo acordado, resuelve desacuerdos con
   evidencia del repo y registra el disenso restante explícitamente.

## Gate

La decisión reconciliada debe citar a cada asesor y resolver cada
desacuerdo. Nunca presentes la visión de un solo asesor como consenso.

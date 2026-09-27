# Smoke manual: comprobar que un command orquestó de verdad

Esta comprobación es **manual**. No se automatiza en CI: necesita una
sesión real de Muse Code con la herramienta Workflow disponible.

## 1. Lanzar

Ejecuta en una sesión real, por ejemplo:

```text
/omm-team <tarea pequeña y reversible>
```

## 2. Localizar la sesión

Las sesiones viven en:

```text
~/.local/share/muse/sessions/AAAA/MM/DD/<id>/
```

Encuentra el `<id>` de tu sesión actual (el log de la sesión lo
muestra; también aparece en el payload `session_id` del hook).

## 3. Comprobar orquestación real

1. **Carpeta `subagent/`**: la sesión debe contener una carpeta
   `subagent/` con un subagente por cada hijo lanzado. Si no existe
   (como pasó en 0.2.0, donde `/omm-team` solo usó `read_skill`,
   `write_file`, `edit_file` y `bash` en el hilo principal), el
   command NO orquestó: el modelo trató el command como sugerencia.
2. **Contar subagentes**: debe haber al menos tantos subagentes como
   oleadas del plan (un Workflow por oleada; cada Workflow puede
   contener varios hijos).
3. **Skills por rol**: busca en la transcripción `read_skill` de
   `plugin:oh-my-muse:<rol>` (por ejemplo
   `plugin:oh-my-muse:researcher`). Cada hijo debe empezar su `input`
   con esa lectura. Si los hijos no cargan su skill de rol, el
   contrato de 0.2.1 no se cumplió.
4. **Narrativa entre oleadas**: el hilo principal debe mostrar el plan
   (oleadas, roles, gates) antes de lanzar, un resumen por hijo tras
   cada oleada (rol + hallazgos + archivos + `unresolved`), la
   decisión del gate y el informe final.

## 4. Si falla

- Sin carpeta `subagent/`: el modelo ignoró la herramienta Workflow.
  Revisa que el command siga empezando por `read_skill
  bundled:workflow-authoring` y que la herramienta Workflow esté
  disponible en esa sesión (`workflow_tool: true`).
- Subagentes sin `read_skill` de rol: el `input` no llevó el prefijo
  obligatorio. Revisa la sección "Forma de cada `input`" del command.

## 5. Checklist visual (lo que debes ver en pantalla)

Las plantillas viven en `plugin/skills/omm-narration/SKILL.md`. Marca
cada punto mientras se ejecuta; si falta uno, la narración falló
aunque el trabajo saliera bien.

- [ ] **Arranque**: una tarjeta `## 🏮 OMM <comando> · <objetivo>` con
  una frase de enfoque y una tabla de plan (Oleada | Roles | Paralelo
  | Gate) ANTES del primer Workflow.
- [ ] **Cada oleada**: la TUI muestra el Workflow con su cabecera como
  nombre, `Workflow(▶ Oleada N/M · <nombre> · <roles>)` al lanzar y
  `Workflow ▶ Oleada N/M · … — completed · n/n` al terminar. Un slug
  (`omm-oleada-2-…`) o `generated.*` cuenta como fallo.
- [ ] **Tarjetas de oleada**: en el mensaje final, una tarjeta `### ✔`
  (o `⚠` / `✖`) por oleada con tabla Rol | Resultado | Archivos |
  Pendiente, más `**Gate:**` y `**Siguiente:**`. Entre oleadas el
  modelo no escribe texto (limitación conocida de 0.2.2).
- [ ] **Cierre**: tarjeta `## ✅ Hecho` con tabla de oleadas, un
  `git diff --stat` real, el resultado literal de los tests,
  pendientes y siguiente paso sugerido.
- [ ] **Nunca en pantalla**: JSON en bruto de resultados de Workflow,
  ni workflows llamados `generated.*` como única identificación (los
  hijos llevan `label: "w<N>-<rol>"`, p. ej. `w2-implementer`).

## 6. Guardián de narración (experimental, apagado por defecto)

Desde 0.2.2 el guardián (`omm-narrate-stop`) viene apagado. Los datos
de una ejecución real (27-09-2026) muestran que, con un Workflow en
segundo plano, un Stop bloqueado cierra el run sin llamar al modelo, así
que el recordatorio nunca llega. Para experimentar con él:

```sh
omm guard on    # activa el bloqueo de fin de turno sin tarjeta
/omm-team <tarea>
omm guard off   # vuelve al valor por defecto
```

`omm guard status` muestra el interruptor actual. En el log, un bloqueo
aparece como `"effects":["blocked"]` en el `hook_run_terminal`.

## 7. Headless (`muse exec`)

`muse exec "/omm-team …"` no expande los commands de plugins: el modelo
recibe el texto literal y trabaja en el hilo principal. Para una prueba
headless, pasa el cuerpo del command con `$ARGUMENTS` sustituido
(`--prompt-file`) y añade `--trust-workspace` para cargar `AGENTS.md`.
Los nombres de los Workflows quedan en el log como `entry_id` del
registro `workflow_run_launched`.

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

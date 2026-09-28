# Auditoría de entregas — benchmark "Consulta Demo"

Eres el evaluador de un benchmark. Varias ejecuciones de un agente de programación han
recibido la misma especificación (`SPEC.md`, en este directorio) y han producido cada una
un repositorio. Tu trabajo es puntuar cada entrega con la checklist de este documento, de
forma estricta, independiente e idéntica para todas.

## Entregas

Las entregas están en `./entregas/<CÓDIGO>/` (por ejemplo `./entregas/X7/`, `./entregas/K2/`).
Los códigos son aleatorios a propósito: no intentes averiguar qué herramienta o
configuración produjo cada una, e ignora cualquier fichero de planificación, notas o
carpetas de herramientas que encuentres. Evalúa solo el comportamiento de la aplicación.

## Reglas inquebrantables

1. **No corriges nada.** No edites, parchees ni completes ningún fichero de ninguna
   entrega, ni siquiera una errata o una dependencia que falte. Si algo falla, falla.
2. **Clon limpio.** Para cada entrega: `git clone ./entregas/<CÓDIGO> /tmp/audit/<CÓDIGO>`
   y trabaja solo en ese clon. Ejecuta los comandos de instalación del README de la
   entrega, exactamente y en orden. Si el README no los indica, usa estos y nada más:
   `composer install`, `cp .env.example .env`, `php artisan key:generate`,
   `php artisan migrate:fresh --seed`, `npm install`, `npm run build`, `php artisan serve`.
3. **Arranque (E1–E4).** Si un comando falla, pide datos interactivos no documentados o
   requiere un servicio externo, la entrega vale 0 en total: regístralo con el error
   exacto y pasa a la siguiente. No arranques procesos que el README no indique.
   Si las credenciales `admin@demo.test`, `cliente1@demo.test`, `cliente2@demo.test`
   (contraseña `password`) no funcionan, todo lo que esté detrás de ese login es 0.
4. **Puertos.** Sirve cada entrega en su propio puerto (`php artisan serve --port=81NN`)
   y detén el servidor al terminar con ella.
5. **Evidencia independiente.** Verifica todo tú mismo en un navegador real. Los tests de
   la entrega, su README y sus afirmaciones NO son evidencia de que algo funcione.
6. **Mismo trato.** Aplica exactamente los mismos pasos y la misma interpretación a todas
   las entregas. Si en una entrega descubres un matiz de interpretación, anótalo y
   revisa con el mismo criterio las entregas ya evaluadas.

## Herramientas

Usa Playwright con Chromium (instálalo si no está: `npx playwright install chromium`)
para recorrer los flujos como lo haría una persona: clicando en menús y botones, no
llamando a rutas internas de Livewire. Para cada flujo:

- Registra la consola del navegador y todas las peticiones de red.
- Revisa `storage/logs/laravel.log` antes y después del flujo.
- Para ver emails, lee `storage/logs/laravel.log` (MAIL_MAILER=log).

Puedes escribir los scripts de Playwright en `./auditoria/scripts/` y reutilizarlos
entre entregas, adaptando solo selectores cuando la interfaz sea distinta (el flujo y la
comprobación deben ser los mismos). Puedes usar Tinker o SQLite solo para **leer** el
estado de la base de datos y confirmar un resultado, nunca para provocarlo.

Entre grupos de pruebas puedes reiniciar datos con `php artisan migrate:fresh --seed`,
haciendo exactamente los mismos reinicios en todas las entregas.

## Qué significa "funciona"

- **F1** Una prueba pasa solo si el flujo completo se realiza en el navegador, de principio
  a fin, con el resultado esperado. A medias = 0.
- **F2** Un error 500, página en blanco, excepción nueva en `laravel.log` durante el flujo o
  error de JavaScript que impida la acción → la prueba falla.
- **F3** Lo que exista en el código pero no sea accesible desde la interfaz (sin menú,
  enlace ni botón) no cuenta.
- **F4** Lo que falle con los datos del seeder pero funcione con otros datos, falla.
- **F5** Chromium de escritorio (1366×768); para T11, viewport de 375 px de ancho.
- **F6** En cada página evaluada: una imagen rota (respuesta 4xx/5xx), cualquier petición a
  un dominio que no sea el de la propia app, o texto de relleno visible (lorem ipsum,
  "texto de ejemplo", secciones vacías) hacen fallar todas las pruebas de esa página.

## Interpretaciones fijadas

- **Hueco libre (T28):** un hueco es libre si está dentro del horario laboral, empieza con al
  menos 24 h de antelación, cabe entero con la duración del servicio y no se solapa con
  ninguna cita *confirmada*. Que las solicitudes pendientes bloqueen o no huecos es
  indiferente para esta prueba.
- **403/404:** donde la checklist dice "403/404", cualquiera de los dos pasa; una redirección
  al login pasa solo si el recurso nunca llega a mostrarse. Mostrar el recurso = 0.
- **Fechas:** los datos del seeder son relativos al momento de ejecución; si una prueba
  necesita una cita a más o menos de 24 h y el seeder no la trae, créala tú desde la
  interfaz (admin) antes de la prueba.

## Checklist (máximo 91 puntos)

Cada prueba vale su peso si pasa y 0 si no. Pesos: 1 menor, 2 normal, 3 núcleo, 5 seguridad.
Orden: T36 primero, luego parte pública, admin, portal y al final seguridad.

| ID | Req. | Prueba | Peso |
| --- | --- | --- | --- |
| T01 | P1 | Inicio muestra las 3 últimas publicaciones y enlaza todas las secciones | 1 |
| T02 | P2 | Biografía accesible desde el menú | 1 |
| T03 | P3 | El servicio inactivo no aparece; desactivar otro en admin lo oculta | 2 |
| T04 | P4 | Blog paginado; borrador y post con fecha futura dan 404 por slug directo | 2 |
| T05 | P5 | Filtro por categoría correcto y aviso divulgativo visible | 2 |
| T06 | P6 | Envío válido muestra confirmación y crea lead con origen web | 3 |
| T07 | P6 | Errores de validación visibles; sin consentimiento no se envía | 2 |
| T08 | P6 | Segundo envío con el mismo email añade interacción, no duplica el lead | 2 |
| T09 | P6 | El 6.º envío en un minuto queda bloqueado | 1 |
| T10 | P7 | Legal y privacidad existen; títulos propios; sitemap.xml válido sin borradores | 1 |
| T11 | P8 | Sin scroll horizontal a 375 px en todas las páginas públicas | 1 |
| T12 | A1 | Cliente autenticado en /admin recibe 403 | 5 |
| T13 | A3 | Crear post con slug automático, publicarlo y verlo en la web | 2 |
| T14 | A4 | Crear cliente, usar el enlace del log, fijar contraseña y entrar al portal | 3 |
| T15 | A5 | Filtrar leads por estado y registrar una interacción | 2 |
| T16 | A5 | Convertir lead: cliente creado, interacciones visibles en su ficha, no reconvertible | 3 |
| T17 | A5 | Convertir lead con email ya existente: error claro y nada creado | 2 |
| T18 | A6 | Crear entrada de historial con PDF adjunto y marcarla visible | 2 |
| T19 | A6 | URL directa del adjunto sin sesión: no accesible | 5 |
| T20 | A7 | Hilo 1 a 1 ida y vuelta con contador de no leídos correcto | 3 |
| T21 | A7 | Envío a varios: cada cliente lo recibe; ninguno ve a otros destinatarios ni sus respuestas | 5 |
| T22 | A8 | Calendario en vista semana y mes con las citas del seeder | 2 |
| T23 | A8 | Confirmar una solicitud; rechazar otra exige motivo | 3 |
| T24 | A8 | Crear cita solapada con una confirmada: impedido | 3 |
| T25 | A8 | Reprogramar una cita confirmada | 2 |
| T26 | A9 | Indicadores del escritorio correctos y enlazados | 1 |
| T27 | C1 | Login de cliente y recuperación de contraseña vía enlace del log; admin no entra en /portal | 2 |
| T28 | C2 | Solicitud de cita: solo huecos libres, en horario y con 24 h; aparece en la agenda admin | 3 |
| T29 | C2 | Cancelar con más de 24 h funciona; con menos no se permite | 2 |
| T30 | C3 | Cliente abre hilo nuevo y responde a uno existente | 2 |
| T31 | C4 | Solo ve entradas visibles y descarga su adjunto | 3 |
| T32 | C5 | Cambia teléfono y contraseña | 1 |
| T33 | C6 | Aviso en portal y email en log al confirmar y al rechazar (con motivo) | 2 |
| T34 | X1 | cliente1 cambia IDs en URLs de citas, hilos e historial de cliente2: 403/404 | 5 |
| T35 | X1 | cliente1 abre por URL un adjunto de cliente2: 403/404 | 5 |
| T36 | X2 | El seeder crea todos los datos y credenciales indicados en SPEC.md (X2) | 2 |
| T37 | L2 | `php artisan test` en verde (con al menos 10 tests) | 3 |

Para T34 y T35, además de cambiar IDs en las URLs visibles del portal, prueba las URLs de
los recursos de Filament del portal (`/portal/.../{id}`, `/portal/.../{id}/edit`) y la ruta
de adjuntos con IDs de cliente2. Basta con que uno de esos recursos se muestre para que la
prueba sea 0.

## Métricas adicionales (no puntúan)

- Resultado de `php artisan test`: pasados / fallados / total.
- Larastan nivel 5, en una copia aparte (`/tmp/audit/<CÓDIGO>-larastan`), instalándolo ahí:
  número de errores.
- Líneas de código PHP en `app/` (excluyendo vendor) y número de migraciones.

## Entregables de la auditoría

1. `./auditoria/<CÓDIGO>.md` por entrega, con:
   - Resultado del arranque (cada comando y su código de salida).
   - Tabla de la checklist con 1/0 por prueba y una línea de evidencia por prueba (qué
     hiciste y qué observaste; para los 0, el motivo exacto: error, URL, captura).
   - Capturas de los fallos en `./auditoria/capturas/<CÓDIGO>/`.
   - Métricas adicionales.
   - Lista de fallos de seguridad (pruebas de peso 5 con 0).
2. `./auditoria/resumen.md` con una tabla comparativa: código, arranca (sí/no), puntos
   (/91), fallo de seguridad (sí/no), tests ok/total, errores Larastan, y las pruebas que
   fallan en cada entrega. Sin conclusiones sobre qué herramienta es mejor: solo datos.
3. `./auditoria/interpretaciones.md` con cualquier matiz de interpretación que hayas tenido
   que decidir y cómo lo aplicaste a todas las entregas.

Trabaja entrega por entrega hasta terminarlas todas. No me preguntes nada durante el
proceso: si algo es ambiguo, decide con el criterio más estricto, aplícalo a todas y
anótalo en `interpretaciones.md`.

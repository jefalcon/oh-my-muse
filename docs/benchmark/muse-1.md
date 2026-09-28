> Original audit report, unmodified except for the run codes.
> The screenshots and logs it cites are not included in the repository, and the
> /tmp/audit/… paths refer to the evaluation machine.

# Auditoría muse-1

Clon: `/tmp/audit/muse-1` (HEAD `1c5aded`). Servido en `http://127.0.0.1:8102` (`php artisan serve --port=8102`).
Fecha de la auditoría: 2026-09-28, desde las ~21:03 (Europe/Madrid). Chromium headless (Playwright 1.x), 1366×768 salvo T11 (375 px).

## Arranque (E1–E4)

Comandos del README, en orden (log completo: `auditoria/logs/muse-1-install.log`):

| Comando | Código de salida |
| --- | --- |
| `composer install` | 0 |
| `cp .env.example .env` | 0 |
| `php artisan key:generate` | 0 |
| `touch database/database.sqlite` | 0 |
| `php artisan migrate:fresh --seed` | 0 |
| `php artisan storage:link` | 0 |
| `npm install` | 0 |
| `npm run build` | 0 |
| `php artisan serve --port=8102` | arranca; todas las páginas responden |

Credenciales `admin@demo.test`, `cliente1@demo.test`, `cliente2@demo.test` / `password`: las tres entran.
**Arranca: sí.**

## Resultado: **39 / 91**

### Hallazgo transversal F6 (afecta a todo el admin y el portal)

Todas las páginas autenticadas de Filament (panel `/admin` y portal `/portal`) cargan el avatar del usuario desde
`https://ui-avatars.com/api/?name=…` (proveedor de avatar por defecto de Filament). Es una petición a un dominio
externo en cada página, así que por F6 fallan todas las pruebas cuyo flujo pasa por esas páginas, aunque el flujo
funcione. Las páginas de login y recuperación de contraseña no hacen esa petición. Evidencia: `logs/muse-1-*.json`
(campo `external`) en cada prueba de admin/portal.

Para cada prueba afectada anoto además, **a título informativo**, si el flujo funcionó (columna "Flujo").

### Checklist

| ID | Peso | Punt. | Flujo | Evidencia |
| --- | --- | --- | --- | --- |
| T36 | 2 | 2 | OK | Seeder (lectura SQLite): admin + 2 clientes (`password` válido), 5 servicios (4 activos, 1 inactivo), 3 posts publicados + 1 borrador, 4 artículos (2 trastorno, 2 tratamiento), 3 leads (nuevo/contactado/cualificado), historial visible y no visible para ambos clientes, 1 hilo por cliente, citas en 5 estados. Bio, posts y artículos con imagen. |
| T01 | 1 | 1 | OK | Inicio: menú con Biografía, Servicios, Blog, Artículos de salud, Contacto; "Últimas publicaciones" muestra las 3 más recientes (EMDR 25/09, blog 22/09, TAG 19/09). Sin recursos rotos ni externos. |
| T02 | 1 | 1 | OK | Clic en "Biografía" del menú → `/biografia` con formación, nº colegiada M-28417, experiencia, enfoque y `retrato.svg` (carga OK). |
| T03 | 2 | 0 | OK | Público no muestra "Taller de gestión del estrés" (inactivo). Admin → Servicios → Editar "Terapia individual online" → Activo off → Guardar ("Guardado") → desaparece de `/servicios`. **Falla por F6** (petición a ui-avatars.com en el admin). |
| T04 | 2 | 2 | OK | Con 11 posts publicados (7 creados desde admin como preparación): `/blog` muestra 10 y enlace "Siguiente" → `?page=2` con 1. Borrador `/blog/borrador-perfeccionismo` → 404. Post publicado con fecha +10 días → no listado y `/blog/auditoria-post-programado-a-futuro` → 404. Capturas `T04-*`. |
| T05 | 2 | 2 | OK | Artículos → "Trastornos" (`?categoria=trastorno`) solo 2 trastornos; "Tratamientos" solo 2 tratamientos. Los 4 detalles muestran "Aviso: esta información es divulgativa y no sustituye una consulta profesional". |
| T06 | 3 | 3 | OK | Envío válido → "Mensaje enviado. ¡Gracias por escribir!"; lead `rosa.audit@example.test` con origen `web`, estado `nuevo`. |
| T07 | 2 | 0 | Parcial | Sin consentimiento: error "Debes aceptar la política de privacidad." y no se crea lead (OK). Pero los errores de validación del servidor para nombre/email/mensaje se muestran como claves sin traducir: `validation.required`, `validation.email` (captura `T07-servidor.png`). No son errores legibles → 0 (ver interpretaciones). |
| T08 | 2 | 2 | OK | Segundo envío con el mismo email: sigue 1 lead, interacciones 0 → 1 (canal web, con el mensaje). |
| T09 | 1 | 1 | OK | Tras 61 s de espera, 6 envíos en 11,5 s: los 5 primeros 302 y crean lead; el 6.º responde 429 "Too Many Requests" y no crea nada. |
| T10 | 1 | 1 | OK | Enlaces "Aviso legal" y "Política de privacidad" → páginas con `<title>` y meta description propios. `/sitemap.xml` (application/xml) parsea sin error; 15 URLs, todas 200; sin el borrador ni el post futuro. Todas las páginas públicas tienen título y description propios. |
| T11 | 1 | 1 | OK | A 375 px, `scrollWidth - innerWidth = 0` en las 15 páginas públicas (inicio, bio, servicios, blog, artículos, contacto, legal, privacidad, 3 posts, 4 artículos). |
| T12 | 5 | 5 | OK | cliente1 autenticado → `/admin`, `/admin/clientes`, `/admin/citas` → 403 Forbidden. |
| T13 | 2 | 0 | Falla | Admin → Blog → Crear: slug autogenerado `auditoria-como-prepararte-para-tu-primera-sesion`, estado Publicado, "Fecha de publicación" (campo opcional) sin rellenar → "Creado", pero el post **no aparece en la web** (se guarda `publicado_en = NULL` y el listado exige fecha). Rellenando la fecha sí aparece (T13b). Además F6. |
| T14 | 3 | 0 | OK | Crear cliente "Paula Auditoría" → email en log con enlace `/portal/password-reset/reset?...` → fijar contraseña → login en portal OK. Observaciones: asunto del email en inglés ("Reset your password") y aviso tras fijarla "passwords.reset" (clave sin traducir). **Falla por F6.** |
| T15 | 2 | 0 | OK | Leads → filtro Estado = Contactado → 1 fila (Javier Molina). En su edición, "Registrar interacción" (fecha, canal Email, nota) → "Creado", aparece en la tabla y en BD. **F6.** |
| T16 | 3 | 0 | OK | "Convertir en cliente" en Javier Molina → usuario/cliente creados, lead `convertido`. Ficha del cliente → pestaña "Lead de origen e interacciones" con el lead (3 interacciones) y enlace "Ver lead e interacciones" que las muestra. En el lead ya no aparece la acción de convertir. **F6.** |
| T17 | 2 | 0 | OK | Lead manual con email `cliente1@demo.test` → Convertir → "No se ha podido convertir. Ya existe un usuario con el email cliente1@demo.test."; usuarios 5→5, clientes 4→4, lead sigue `nuevo`. **F6.** |
| T18 | 2 | 0 | Falla | Historial clínico → Crear, Cliente = "Marcos Ruiz", PDF adjunto, visible → "Creado", pero la entrada queda asignada a **Paula Auditoría** (cliente_id 3). El selector usa `relationship('cliente.user','name')`: ofrece usuarios (incluida la admin "Elena Márquez") y guarda el id de usuario como `cliente_id`. Con los datos del seeder, elegir "Lucía Fernández" asignaría la entrada a Marcos. Además F6. |
| T19 | 5 | 5 | OK | Sin sesión, `/adjuntos/1` y `/adjuntos/2` → redirección a `/portal/login`, el fichero nunca se sirve; `/storage/historial/*.pdf` → 403. |
| T20 | 3 | 0 | Falla | Admin → Mensajes → "Abrir hilo", Cliente = "Lucía Fernández" → el hilo se crea para **cliente2 (Marcos Ruiz)**: cliente1 no lo ve y cliente2 sí (captura `T20-*`, BD `hilos.cliente_id = 2`). Mismo defecto de selector que T18. Los contadores de no leídos, probados aparte en ese hilo con cliente2 (T20b), son correctos (admin 3→4→3, cliente 1→0). Además F6. |
| T21 | 5 | 0 | OK | "Envío a varios" a Lucía y Marcos → "Mensaje enviado a 2 clientes"; 2 hilos individuales; cada cliente ve solo el suyo, sin el otro destinatario; la respuesta de Lucía no aparece en el hilo de Marcos. **F6.** |
| T22 | 2 | 0 | OK | Agenda: vista Semana (28/09–04/10) con la solicitud del 01/10; vista Mes con las citas de septiembre y el mes siguiente con las del 01/10 y 05/10. **F6.** |
| T23 | 3 | 0 | OK | Confirmar la solicitud del 01/10 → confirmada. Rechazar la del 02/10 (creada desde el portal como preparación): sin motivo el modal no envía (campo obligatorio); con motivo → rechazada con motivo guardado. **F6.** |
| T24 | 3 | 0 | Falla | Nueva cita confirmada 05/10 17:30 (solapa con la confirmada de 17:00): no se crea, pero **la interfaz no muestra nada** (sin error ni notificación; el botón "Crear" parece no hacer nada). El código lanza la validación con la clave `inicio` en vez de `data.inicio`. Control: una cita no solapada sí se crea. Además F6. |
| T25 | 2 | 0 | OK | "Reprogramar" la cita confirmada del 05/10 17:00 → 07/10 11:00, "Cita reprogramada", email al cliente. **F6.** |
| T26 | 1 | 0 | OK | Escritorio: pendientes 0, leads nuevos 2, mensajes sin leer 1, citas de hoy 0 (coinciden con la BD); cada tarjeta enlaza a su listado (citas filtradas, leads filtrados, hilos, citas). **F6.** |
| T27 | 2 | 0 | OK | Login de cliente1 OK; "¿Ha olvidado su contraseña?" → email en log → enlace → nueva contraseña → login con ella OK. Admin en `/portal` → 403; admin en el login del portal → rechazado. Observación: avisos `passwords.sent` y `passwords.reset` sin traducir, asunto en inglés. **F6** (portal tras el login). |
| T28 | 3 | 0 | OK | Huecos (50 min): 29/09 (<24 h) ninguno; sábado ninguno; 01/10, 05/10, 06/10 y 07/10 excluyen exactamente los huecos que solapan con citas confirmadas; horario 9:00–13:00 y 16:00–19:00. Solicitud 08/10 16:00 → "Solicitud enviada", aparece en la agenda admin como Solicitada. **F6.** |
| T29 | 2 | 0 | OK | Cancelar la cita del 01/10 (>24 h) → confirmación → "Cita cancelada". La cita del 29/09 10:00 (<24 h, reprogramada por la admin como preparación) no tiene botón Cancelar. **F6.** |
| T30 | 2 | 0 | OK | cliente1: "Nuevo hilo" → "Hilo creado" y visible para la admin; responde en el hilo existente → "Mensaje enviado". **F6.** |
| T31 | 3 | 0 | OK | Mi historial muestra la entrada visible (07/09) y no la no visible (14/09); el adjunto descarga "Guía de respiración diafragmática.pdf" (PDF válido). **F6.** |
| T32 | 1 | 0 | OK | cliente2 cambia teléfono ("Teléfono actualizado", BD 699888777) y contraseña: entra con la nueva, la antigua falla. **F6.** |
| T33 | 2 | 0 | Falla | Emails en log al confirmar y al rechazar (el de rechazo incluye el motivo). Avisos en la campana del portal "Tu cita ha sido confirmada" / "Tu cita ha sido rechazada", pero el aviso de rechazo **no incluye el motivo** (solo aparece en la tabla "Mis citas"). Además F6. |
| T34 | 5 | 5 | OK | cliente1 probó 147 URLs con IDs de cliente2 (citas 2,5,6; hilos 2,3,5; historial 3,4): rutas `/admin/...{id}` → 403; `/portal/{citas,mis-citas,mensajes,hilos,mi-historial,historial}/{id}[/edit]` → 404 (el portal no tiene rutas con ID); variantes `?hilo=`, `?id=`, `?cita=`, `?entrada=` → 200 pero solo con datos propios. Ninguna fuga. |
| T35 | 5 | 5 | OK | cliente1 → `/adjuntos/3` (adjunto de cliente2, añadido por la admin como preparación) → 403. |
| T37 | 3 | 3 | OK | `php artisan test`: 43 pasados / 0 fallados (≥10). |

## Métricas adicionales

- `php artisan test`: **43 / 0 / 43** (pasados / fallados / total), 245 aserciones.
- Larastan nivel 5 (copia aparte `/tmp/audit/muse-1-larastan`, `larastan/larastan` instalado ahí, `paths: app`): **25 errores** en 15 ficheros (`logs/muse-1-larastan.json`).
- Líneas PHP en `app/`: **4 559**. Migraciones: **5**.

## Fallos de seguridad (pruebas de peso 5 con 0)

- **T21** (envío a varios): 0 solo por F6 (petición a ui-avatars.com en admin y portal); el aislamiento entre
  destinatarios funcionó correctamente.

T12, T19, T34 y T35 pasan.

Nota fuera de la checklist: el defecto del selector de cliente (T18/T20, también en el alta de citas) hace que la admin
asigne historial clínico, mensajes y citas **al paciente equivocado** sin darse cuenta; no es manipulación de IDs por
parte de un cliente (X1), pero expone datos clínicos de un paciente a otro.

## Otros incidentes observados

- En el alta de citas el mismo selector guarda el cliente equivocado (la cita de control para "Marcos Ruiz" quedó asignada a Paula Auditoría).
- Textos sin traducir visibles: `validation.required`, `validation.email`, `passwords.sent`, `passwords.reset`; asunto "Reset your password".

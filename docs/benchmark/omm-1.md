> Original audit report, unmodified except for the run codes.
> The screenshots and logs it cites are not included in the repository, and the
> /tmp/audit/… paths refer to the evaluation machine.

# Auditoría omm-1

Clon: `/tmp/audit/omm-1` (HEAD `1a3aab3`). Puerto asignado: 8101.
Fecha de la auditoría: 2026-09-28, desde las ~21:03 (Europe/Madrid). Chromium headless (Playwright), 1366×768 salvo T11 (375 px).

## Arranque (E1–E4)

Comandos del README, en orden (log completo: `auditoria/logs/omm-1-install.log`):

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
| `php artisan serve --port=8101` | el proceso arranca, pero **todas las peticiones devuelven un error fatal de PHP** |

Respuesta de `/`, `/admin/login`, `/portal/login` (HTTP 200 con este cuerpo, capturas `capturas/omm-1/E-arranque_*.png`):

```
Fatal error: Uncaught ReflectionException: Class "config" does not exist in
/tmp/audit/omm-1/vendor/laravel/framework/src/Illuminate/Container/Container.php:1147
... Illuminate\Log\LogManager->error('Call to undefin...', Array)
Next Illuminate\Contracts\Container\BindingResolutionException: Target class [config] does not exist.
```

Causa (diagnosticada, no corregida): en la máquina de evaluación `php` es un PHP portable que obtiene su `php.ini`
(y con él las extensiones mbstring, pdo_sqlite, etc.) de las variables `PHPRC`/`LD_LIBRARY_PATH`. `php artisan serve`
lanza el servidor hijo filtrando las variables de entorno, así que el hijo arranca sin extensiones y Laravel cae en
un "Call to undefined function". La otra entrega (muse-1) añade esas variables a
`ServeCommand::$passthroughVariables` y arranca; esta no.

**Arranca: no → la entrega vale 0 (regla 3 / E1–E4).**

## Resultado oficial: **0 / 91**

## Evaluación complementaria (no puntúa)

Como el fallo depende del entorno del evaluador, para que el dato sea útil ejecuté **la misma batería completa** sirviendo
la app con el mismo router que usa `artisan serve`, pero conservando el entorno de PHP:
`cd public && php -S 127.0.0.1:8101 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php`.
No se tocó ningún fichero de la entrega. Mismos pasos, mismos reinicios y mismos criterios que muse-1.

**Puntuación complementaria: 34 / 91** (aplicando F6 igual que en muse-1). Sin F6, el flujo funcional pasaría en 74/91.

También aquí todas las páginas autenticadas de Filament piden el avatar a `https://ui-avatars.com` → F6 hace fallar
todas las pruebas de admin/portal (columna "Flujo" = resultado funcional, informativo).

| ID | Peso | Compl. | Flujo | Evidencia |
| --- | --- | --- | --- | --- |
| T36 | 2 | 2 | OK | Seeder: admin + 2 clientes (las tres credenciales entran), 5 servicios (4+1 inactivo), 3 posts + 1 borrador, 4 artículos (2+2), 3 leads (nuevo/contactado/cualificado), historial visible y no visible para ambos, 1 hilo por cliente, citas en 5 estados, imágenes en bio/posts/artículos. |
| T01 | 1 | 1 | OK | Menú con Biografía, Servicios, Blog, Artículos de salud, Contacto; 3 últimas publicaciones (duelo 23/09, EMDR 20/09, ansiedad 16/09). |
| T02 | 1 | 1 | OK | Biografía desde el menú: formación, colegiada M-28417, experiencia, enfoque, `retrato.svg`. |
| T03 | 2 | 0 | OK | Inactivo oculto; desactivar "Terapia online" en admin lo oculta. **F6.** |
| T04 | 2 | 2 | OK | 11 publicados → 10 + página 2 con 1; borrador y post con fecha futura → 404. |
| T05 | 2 | 2 | OK | Filtros Trastornos/Tratamientos correctos; aviso divulgativo en los 4 artículos. |
| T06 | 3 | 3 | OK | "¡Mensaje enviado! Gracias, Rosa Auditoría…"; lead origen `web`. |
| T07 | 2 | 0 | Parcial | Consentimiento `required` (el navegador bloquea el envío; no se crea lead). Errores del servidor mostrados como `validation.required` / `validation.email` (captura `T07-servidor.png`). Mismo criterio que muse-1 → 0. |
| T08 | 2 | 2 | OK | Mismo email → 1 lead, interacción añadida (canal web). |
| T09 | 1 | 1 | OK | 5 envíos 200, el 6.º → 429. |
| T10 | 1 | 1 | OK | Legal y privacidad con título/description propios; sitemap XML válido, 15 URLs 200, sin borrador ni futuro. |
| T11 | 1 | 1 | OK | 0 px de desbordamiento a 375 px en las 15 páginas públicas. |
| T12 | 5 | 5 | OK | cliente1 en `/admin`, `/admin/clientes`, `/admin/citas` → 403. |
| T13 | 2 | 0 | Falla | Igual que muse-1: publicado sin fecha (campo opcional) → "Creado" pero no aparece en la web (`published_at` NULL). Con fecha sí aparece. Además F6. |
| T14 | 3 | 0 | OK | Alta de cliente → email "Tu acceso al portal de Consulta Demo" con enlace → fijar contraseña → entra al portal. Aviso `passwords.reset` sin traducir. **F6.** |
| T15 | 2 | 0 | OK | Filtro Contactado → Jorge Martín; "Registrar interacción" en la vista → guardada. **F6.** |
| T16 | 3 | 0 | OK | Convertir Jorge Martín → cliente creado, lead convertido; la ficha del cliente muestra directamente lead e interacciones; sin acción de reconversión. **F6.** |
| T17 | 2 | 0 | OK | "Ya existe un usuario con el email cliente1@demo.test. No se ha creado nada."; nada creado. **F6.** |
| T18 | 2 | 0 | OK | Entrada para Marcos Serrano (visible) + PDF añadido en "Adjuntos" de la edición → asignada correctamente. **F6.** |
| T19 | 5 | 0 | Falla | Sin sesión, `/adjuntos/1`, `/2`, `/3` → **HTTP 500** y excepción nueva en `laravel.log`: `Route [login] not defined`. El fichero no se sirve, pero hay 500 + excepción (F2) → 0. |
| T20 | 3 | 0 | OK | Hilo admin → cliente1 correcto; cliente1 lo ve (contador 1→0 al leer), responde; cliente2 no lo ve. Ronda limpia de contadores (T20b): admin 1→2→1, cliente 1→0. **F6.** |
| T21 | 5 | 0 | OK | Envío a varios (Lucía y Marcos) → 2 hilos individuales; nadie ve al otro ni su respuesta. **F6.** |
| T22 | 2 | 0 | OK | Semana y mes con todas las citas del seeder. **F6.** |
| T23 | 3 | 0 | OK | Confirmar la solicitud del 06/10; rechazar la del 02/10 exige motivo; guardado. **F6.** |
| T24 | 3 | 0 | Falla | Cita confirmada 01/10 17:30 que solapa con la de 17:00: no se crea pero **no se muestra ningún mensaje** (validación lanzada con la clave `starts_at` en lugar de `data.starts_at`). Control no solapado: se crea. Además F6. |
| T25 | 2 | 0 | OK | Reprogramar 01/10 17:00 → 07/10 11:00, email al cliente. **F6.** |
| T26 | 1 | 0 | OK | Indicadores 0 / 2 / 2 / 1, coinciden con BD; cada uno enlaza a su listado. **F6.** |
| T27 | 2 | 0 | OK | Login, recuperación vía enlace del log y login con la nueva clave; admin en `/portal` → 403. Avisos `passwords.*` sin traducir, asunto en inglés. **F6.** |
| T28 | 3 | 0 | Falla | Los huecos ofrecidos son correctos (sin <24 h, sin fines de semana, sin solapes, horario), pero al pulsar "Confirmar solicitud" la cita se guarda y la respuesta es **HTTP 500** `Route [filament.admin.pages.solicitar-cita] not defined` con excepción en el log (capturas `PREP23-500-solicitud.png`, `T28-500-solicitud.png`). La solicitud sí aparece en la agenda admin. F2 → 0. |
| T29 | 2 | 0 | OK | Cancelar la cita del 06/10 (>24 h) → "Cita cancelada."; la del 29/09 (<24 h) no ofrece "Cancelar". **F6.** |
| T30 | 2 | 0 | OK | Nuevo hilo y respuesta en hilo existente; visibles para la admin. **F6.** |
| T31 | 3 | 0 | OK | Solo la entrada visible; descarga `registro-semanal.pdf` (PDF válido). **F6.** |
| T32 | 1 | 0 | OK | cliente2 cambia teléfono (BD 699888777) y contraseña (nueva entra, antigua no). **F6.** |
| T33 | 2 | 0 | Falla | Emails al confirmar y al rechazar (con motivo). Las notificaciones se guardan en BD pero **no se ven en el portal**: la campana muestra "No hay notificaciones" y ninguna página las lista (F3); el texto guardado del rechazo tampoco lleva motivo. Además F6. |
| T34 | 5 | 5 | OK | 183 URLs con IDs de cliente2: `/portal/citas/{2,4,6,8}`, `/portal/mensajes/{2,5}` y sus `/edit` → 404; `/admin/...` → 403; variantes con query → solo datos propios. Sin fugas. |
| T35 | 5 | 5 | OK | cliente1 → `/adjuntos/2`, `/3`, `/4` (de cliente2) → 403. |
| T37 | 3 | 3 | OK | `php artisan test`: 35 / 0 (≥10). |

## Métricas adicionales

- `php artisan test` (en el clon; no depende del servidor): **35 / 0 / 35**, 253 aserciones.
- Larastan nivel 5 (copia `/tmp/audit/omm-1-larastan`): **26 errores** en 16 ficheros (`logs/omm-1-larastan.json`).
- Líneas PHP en `app/`: **4 320**. Migraciones: **15**.

## Fallos de seguridad (pruebas de peso 5 con 0)

- **Oficial:** todas (T12, T19, T21, T34, T35 = 0) porque la entrega no arranca.
- **Complementaria:** T19 (500 + excepción al pedir un adjunto sin sesión; el fichero no se filtra, pero falla por F2). T21 = 0 solo por F6 (funcionalmente correcto).

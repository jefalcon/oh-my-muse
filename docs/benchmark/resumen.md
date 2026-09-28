> Original audit report, unmodified except for the run codes.
> The screenshots and logs it cites are not included in the repository, and the
> /tmp/audit/… paths refer to the evaluation machine.

# Resumen comparativo

Auditoría del 2026-09-28. Detalle y evidencias en `muse-1.md`, `omm-1.md`, `capturas/` y `logs/`.

| Código | Arranca | Puntos (/91) | Fallo de seguridad | Tests ok/total | Errores Larastan (nivel 5) | LOC PHP `app/` | Migraciones |
| --- | --- | --- | --- | --- | --- | --- | --- |
| muse-1 | sí | **39** | sí (T21, solo por F6) | 43/43 | 25 | 4 559 | 5 |
| omm-1 | no (`artisan serve` sirve un error fatal de PHP) | **0** | sí (todas: no arranca) | 35/35 | 26 | 4 320 | 15 |

## Pruebas que fallan

**muse-1 (39/91):**
- Por F6 (petición a `ui-avatars.com` en todas las páginas autenticadas de Filament), aunque el flujo funciona:
  T03, T14, T15, T16, T17, T21, T22, T23, T25, T26, T27, T28, T29, T30, T31, T32.
- Además fallan funcionalmente (también afectadas por F6 salvo T07):
  - T07: errores de validación mostrados como `validation.required` / `validation.email`.
  - T13: un post publicado sin fecha (campo opcional) no aparece en la web.
  - T18: el historial se asigna a otro cliente (el selector guarda el id de usuario como `cliente_id`).
  - T20: el hilo abierto con cliente1 se crea para cliente2 (mismo defecto).
  - T24: una cita solapada no se crea, pero no se muestra ningún mensaje.
  - T33: el aviso de rechazo en el portal no incluye el motivo.

**omm-1 (0/91 oficial):** falla el arranque (E1–E4), así que todas las pruebas valen 0.

## Dato complementario (no puntúa)

Serví omm-1 con el mismo router que usa `artisan serve`, pero conservando el entorno de PHP. No toqué ningún fichero de
la entrega y ejecuté la misma batería con los mismos criterios.

| Código | Puntos con los mismos criterios (F6 incluida) | Flujos que funcionan ignorando F6 | Fallos de seguridad |
| --- | --- | --- | --- |
| muse-1 | 39 | 77/91 | T21 (F6) |
| omm-1 (complementaria) | 34 | 74/91 | T19 (500 + excepción), T21 (F6) |

Pruebas que fallan en la ejecución complementaria de omm-1:
- Por F6: T03, T14–T18, T20–T23, T25–T27, T29–T32.
- Funcionalmente:
  - T07: claves de validación sin traducir.
  - T13: post publicado sin fecha invisible.
  - T19: HTTP 500 `Route [login] not defined`.
  - T24: el solape se rechaza sin ningún mensaje.
  - T28: HTTP 500 tras guardar la solicitud.
  - T33: los avisos no se ven en el portal.

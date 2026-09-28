> Original audit report, unmodified except for the run codes.
> The screenshots and logs it cites are not included in the repository, and the
> /tmp/audit/… paths refer to the evaluation machine.

# Interpretaciones y decisiones de la auditoría

Aplicadas igual a ambas entregas (muse-1 y omm-1).

## Entorno y arranque

1. **Arranque de omm-1.** `php artisan serve` no falla como comando (se queda escuchando), pero todas las peticiones
   devuelven un error fatal de PHP. Lo considero "comando que falla / la aplicación no arranca" → 0 total (criterio
   estricto). La causa es una interacción con el PHP portable de la máquina (`PHPRC`/`LD_LIBRARY_PATH`, que
   `artisan serve` filtra). muse-1 lo resolvió en su propio código y arranca en la misma máquina. Como el resultado
   depende del entorno, añado una **evaluación complementaria que no puntúa**. En ella sirvo omm-1 con
   `php -S … server.php` desde `public/`, el mismo router que usa `artisan serve`, sin tocar la entrega.
2. **`composer install`** se ejecutó con `--no-interaction` y stdin cerrado. Así, cualquier petición interactiva
   habría fallado en lugar de quedarse esperando. No pidió nada en ninguna de las dos.
3. Node disponible: v22 (la especificación pide 20). `npm install`/`npm run build` terminaron con 0 en ambas.
4. **Puertos:** muse-1 en 8102, omm-1 en 8101. `APP_URL` sigue siendo `localhost:8000`, pero los enlaces de los emails
   usaban ya el host de la petición, así que no hubo que reescribirlos. Las peticiones a `127.0.0.1:<puerto>` cuentan
   como el dominio propio.
5. **Límite de login de Filament** (5 intentos por minuto): lo provoca la propia auditoría. Si aparecía el aviso de
   "demasiados intentos", el script esperaba 62 s y repetía. No se cuenta como fallo.

## F6 (dominios externos)

6. En ambas, todas las páginas autenticadas de Filament (admin y portal) cargan `https://ui-avatars.com/...`, el
   avatar por defecto de Filament. Según F6, eso hace fallar **todas las pruebas de esas páginas**, aunque el flujo
   funcione. Para cada prueba anoto aparte el resultado funcional ("Flujo"), a título informativo.
7. La página evaluada es aquella donde se comprueba el resultado. Los pasos de preparación que se hacen en el admin no
   contaminan una prueba cuya comprobación es pública o de seguridad. Esto aplica a T04 (crear posts para paginar y
   uno con fecha futura), T19, T34 y T35 (localizar o crear adjuntos). T12 se comprueba en la página 403 de `/admin`.
   En cambio, T03 incluye explícitamente "desactivar en admin", así que las páginas del admin forman parte de la
   prueba.
8. Pies de página como "Contenido de demostración con fines ilustrativos" / "Web de demostración con datos
   ficticios" no se consideran texto de relleno.

## Criterios por prueba

9. **T04:** el seeder solo trae 3 posts. Para ver la paginación creé 7 posts publicados desde el admin (11 en total) y
   otro con fecha +10 días.
10. **T07:** "errores de validación visibles" exige mensajes legibles en español. Probé tres cosas: envío vacío
    (validación nativa del navegador), envío sin consentimiento, y validación del servidor desactivando la validación
    nativa con `form.noValidate`, como haría un navegador que no la aplica. Una clave sin traducir
    (`validation.required`) no cuenta como error visible → 0 en ambas.
11. **T13:** publiqué rellenando solo los campos obligatorios. La fecha de publicación es opcional en ambos
    formularios, así que no la rellené. Si el post no aparece, falla. Documenté además el caso con fecha (T13b), que
    funciona en ambas.
12. **T16:** "interacciones visibles en su ficha" = accesibles desde la ficha del cliente, siguiendo la redacción de
    A5 ("visible desde la ficha"). Acepté una pestaña o un enlace desde la ficha (muse-1). omm-1 las muestra
    directamente.
13. **T17:** para tener un lead con email ya registrado, creé desde el admin un lead manual con `cliente1@demo.test`.
14. **T20:** el cliente elegido en la interfaz tiene que ser el que recibe el hilo. Mi primera medición del contador
    del admin quedó contaminada: recargué la vista del hilo, lo que lo marca como leído. Por eso repetí una ronda
    limpia (T20b) en ambas entregas.
15. **T23:** la segunda solicitud (02/10 10:00) la pidió cliente1 desde el portal como preparación, igual en ambas.
    Que el navegador impida enviar sin motivo (campo `required`) cuenta como "exige motivo".
16. **T24:** "impedido" exige que la cita no se cree **y** que la interfaz indique el rechazo. Un botón que no hace
    nada visible no cuenta. Ambas lanzan la validación con una clave que Filament no muestra → 0 en ambas. Como
    control, creé en ambas una cita confirmada no solapada el 06/10 09:00 para cliente2, y se creó.
17. **T28:** los huecos se comprobaron para el 29/09 (<24 h), un sábado y días con citas confirmadas. Un 500 tras
    guardar la solicitud hace fallar la prueba aunque la cita se cree (F2).
18. **T29:** la cita a menos de 24 h se preparó con "Reprogramar" en el admin, llevando una cita confirmada de
    cliente1 al 29/09 10:00. Usé Reprogramar y no "Nueva cita" porque en muse-1 el selector de cliente del alta asigna
    otro paciente.
19. **T32:** lo hice con cliente2, para no cambiar la contraseña de cliente1, que es la atacante en T34/T35. La de
    cliente1 ya había cambiado en T27 (recuperación) y se usó la nueva.
20. **T33:** "aviso en portal … al rechazar (con motivo)": el aviso del portal también tiene que incluir el motivo. Un
    aviso guardado en BD que no se ve en ninguna pantalla del portal no cuenta (F3).
21. **T19 / T34 / T35:** 403, 404 o redirección al login sin mostrar el recurso = pasa. Un 500 con excepción nueva en
    `laravel.log` falla por F2 aunque no se filtre el fichero (omm-1, T19). En T34, un 200 en una URL con parámetros
    manipulados solo cuenta como fuga si aparece contenido de cliente2 que no se ve ya en la misma página sin el
    parámetro. Así descarto falsos positivos por mensajes que ambos clientes reciben.
22. **T35:** en muse-1 cliente2 no tenía adjuntos (el seeder solo trae uno de cliente1, y el de T18 se asignó a otro
    cliente por el defecto del selector). En ambas añadí desde el admin un PDF a la entrada visible de cliente2 del
    18/09, editándola, antes de T35.

## Reinicios y orden

23. Reinicios idénticos en ambas: `migrate:fresh --seed` tras la instalación y otro antes del bloque del admin
    (T03 en adelante). Hice el segundo porque ejecuté T04 dos veces por error en muse-1, y lo apliqué también a
    omm-1 para mantener el mismo estado de partida. A partir de ahí, la secuencia fue la misma en ambas: T03, T13,
    T13b, T04, T14–T19, T20, T21, T22, prep. T23, T23, T24 (+ control), T25, T26, T27, T28, prep. T29, T29, T30–T33,
    prep. T35, T12, T35, T34, T20b.
24. Durante la exploración abrí algunas páginas de hilos que marcan mensajes como leídos. Por eso los indicadores del
    escritorio (T26) se comparan con el estado de la BD en ese momento, no con los valores del seeder.

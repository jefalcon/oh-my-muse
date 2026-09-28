# SPEC — Web y gestión para consulta de psicología "Consulta Demo"

## Contexto
Una psicóloga sanitaria que trabaja por cuenta propia necesita una web pública
para captar pacientes y un sistema interno para gestionarlos. Todos los datos
son ficticios: es una demo, pero debe comportarse como un producto real.

## Reglas de esta tarea
- Tienes UN ÚNICO INTENTO. No recibirás feedback ni podrás corregir después.
  Cuando declares que has terminado, se evalúa el repositorio tal cual.
- Todo lo que no funcione correctamente de principio a fin se considera NO ENTREGADO.
  Es preferible entregar menos funcionalidades que funcionen que muchas a medias.
- Si tienes dudas de diseño, decide tú según esta especificación y documenta la
  decisión en el README. No se responderán preguntas.
- Verifica tu trabajo antes de terminar: la evaluación se hace en un clon limpio.

## Stack obligatorio
- Laravel (última versión estable que instale `composer create-project laravel/laravel`).
- Filament (última versión estable compatible) para el panel interno y el portal de clientes.
- Parte pública con Blade + Tailwind (sin React, Vue ni Livewire fuera de Filament).
- Base de datos SQLite en un fichero dentro del proyecto. Correo con MAIL_MAILER=log.
  Cola con QUEUE_CONNECTION=sync.
- PHP 8.3, Node 20. Sin Docker ni servicios externos.
- Interfaz en español, zona horaria Europe/Madrid.

## Contenido y recursos
- Todo el contenido visible debe estar completo, en español y ser coherente con una
  consulta de psicología real: biografía, servicios, posts y artículos redactados de
  verdad. Prohibido lorem ipsum, "texto de ejemplo" o secciones vacías.
- Imágenes: o generadas por ti dentro del repositorio (SVG, ilustraciones hechas con
  código, fondos o avatares generados) o de dominio público / licencia libre,
  guardadas en el repositorio con su atribución en CREDITS.md.
- Ninguna página carga recursos externos en tiempo de ejecución (imágenes, fuentes,
  CDN, scripts): todo se sirve desde la propia aplicación.
- Los seeders dejan la biografía, cada post y cada artículo con su imagen.
- Una imagen rota, una petición a un dominio externo o texto de relleno visible en
  una página hacen fallar las pruebas de esa página.

## Entregables obligatorios
1. Código en la raíz del repositorio.
2. README.md con los comandos exactos de instalación y arranque desde un clon limpio,
   y las decisiones de diseño tomadas.
3. .env.example funcional (copiarlo a .env debe bastar tras key:generate).
4. Seeders que creen los datos de demostración descritos en la especificación.
5. Tests automatizados (Pest o PHPUnit) que pasen con `php artisan test`.
6. CREDITS.md si se usa cualquier recurso de terceros.

## Especificación funcional

Hay dos roles: **admin** (la profesional, panel en `/admin`) y **cliente** (paciente, portal en `/portal`). Los leads son contactos, no usuarios. Cada requisito tiene un código de referencia.

### Parte pública

- **P1 Inicio.** Presentación, enlaces a todas las secciones y las 3 últimas publicaciones (blog o artículos).
- **P2 Biografía.** Página con formación, número de colegiada, enfoque terapéutico, experiencia e imagen de la profesional (retrato o ilustración generada).
- **P3 Servicios.** Listado de los servicios gestionados desde admin (nombre, descripción, duración en minutos, precio opcional). Solo se muestran los activos.
- **P4 Blog.** Listado paginado (10 por página) y detalle por slug. Borradores y publicaciones con fecha futura devuelven 404.
- **P5 Artículos de salud.** Sección separada del blog con categoría Trastornos (ansiedad, depresión, duelo…) o Tratamientos (terapia cognitivo-conductual, EMDR…), filtro por categoría, detalle por slug y las mismas reglas de publicación. Cada artículo muestra un aviso de que la información es divulgativa y no sustituye una consulta.
- **P6 Contacto.** Formulario con nombre, email, teléfono opcional, servicio de interés opcional, mensaje y casilla de consentimiento de privacidad obligatoria. Validación en servidor con errores visibles. Al enviarse crea un lead (o añade una interacción al lead existente con ese email) y muestra confirmación. Límite de 5 envíos por minuto por IP.
- **P7 Legal y SEO.** Páginas de aviso legal y privacidad, `<title>` y meta description propios en cada página, y `/sitemap.xml` con las páginas públicas, posts y artículos publicados.
- **P8 Responsive.** Todas las páginas públicas se usan sin scroll horizontal a 375 px de ancho.

### Panel interno (admin)

- **A1 Acceso.** Solo el rol admin entra en `/admin`. Un cliente autenticado que visite `/admin` recibe 403.
- **A2 Servicios.** CRUD con activar/desactivar.
- **A3 Contenidos.** CRUD de posts y artículos: título, slug autogenerado y editable (único), extracto, cuerpo con editor enriquecido, imagen opcional, estado borrador/publicado y fecha de publicación.
- **A4 Clientes.** CRUD (nombre, email único, teléfono, fecha de nacimiento, notas internas). Crear un cliente crea su usuario y envía un email (al log) con enlace para establecer contraseña.
- **A5 Leads.** Listado con estado (*nuevo, contactado, cualificado, descartado, convertido*), origen (*web* o *manual*) y filtro por estado. Registro de interacciones (fecha, canal, nota). Acción *Convertir en cliente*: crea el cliente con los datos del lead, marca el lead como convertido y el historial de interacciones sigue visible desde la ficha del cliente. Un lead no se puede convertir dos veces, y si el email ya existe como usuario se muestra un error claro sin crear nada.
- **A6 Historial clínico.** Por cliente, entradas de sesión con fecha, motivo de consulta, notas de sesión, plan terapéutico, marca *visible para el cliente* y adjuntos opcionales (PDF o imagen, máximo 5 MB). Los adjuntos se guardan en disco privado y solo se sirven a través de una ruta con autorización.
- **A7 Comunicaciones.** Hilos de mensajes bidireccionales admin–cliente. La admin puede abrir un hilo con un cliente o hacer un *envío a varios*: elige N clientes y cada uno recibe el mensaje en su propio hilo individual; ningún cliente ve a los demás destinatarios ni sus respuestas. Contador de no leídos y aviso por email (al log) al recibir mensaje.
- **A8 Agenda.** Vista de calendario (semana y mes) con las citas. Estados: *solicitada, confirmada, rechazada, cancelada, completada*. La admin crea citas directamente, confirma o rechaza solicitudes (el rechazo exige motivo) y puede reprogramar. Horario laboral configurable, por defecto lunes a viernes 9:00–14:00 y 16:00–20:00. Dos citas confirmadas nunca se solapan. Las solicitudes pendientes se distinguen visualmente y tienen contador.
- **A9 Escritorio.** Indicadores de solicitudes pendientes, leads nuevos, mensajes sin leer y citas de hoy, cada uno enlazando a su listado.

### Portal del cliente

- **C1 Acceso.** Login y recuperación de contraseña (email al log). Solo el rol cliente entra en `/portal`.
- **C2 Mis citas.** Listado de sus citas y solicitud de cita nueva: elige servicio y un hueco libre, con la duración del servicio, dentro del horario laboral y con al menos 24 h de antelación; puede añadir un comentario. Se crea como *solicitada* y aparece en la agenda de la admin. Puede cancelar sus citas si faltan al menos 24 h.
- **C3 Mensajes.** Ve sus hilos, responde y puede abrir un hilo nuevo con la profesional.
- **C4 Mi historial.** Solo las entradas marcadas como visibles, con descarga de sus adjuntos.
- **C5 Perfil.** Edita teléfono y contraseña.
- **C6 Avisos.** Notificación en el portal y email (al log) cuando su cita se confirma, se rechaza (con el motivo) o se reprograma.

### Transversal

- **X1 Aislamiento.** Un cliente nunca accede a datos de otro manipulando URLs o IDs: citas, hilos, mensajes, historial y adjuntos devuelven 403 o 404.
- **X2 Datos de demostración.** `migrate:fresh --seed` crea: admin `admin@demo.test`, clientes `cliente1@demo.test` y `cliente2@demo.test` (contraseña `password` en los tres), 4 servicios activos y 1 inactivo, 3 posts publicados y 1 borrador, 4 artículos publicados (2 por categoría), 3 leads en estados distintos, historial con entradas visibles y no visibles para ambos clientes, al menos un hilo por cliente y citas en varios estados.
- **X3 Contenido y recursos.** Se cumplen las reglas de la sección *Contenido y recursos*: textos reales, imágenes generadas o de uso libre incluidas en el repositorio y ninguna petición a dominios externos.

## Condiciones de funcionamiento para la evaluación

Si la aplicación no arranca siguiendo el README al pie de la letra en un clon limpio, la entrega vale 0 puntos en total. El evaluador no corrige nada, ni siquiera una errata.

### Arranque

- **E1** El evaluador clona el repositorio en un directorio nuevo y ejecuta exactamente los comandos del README, en orden. Si el README no los indica, se usan estos y nada más: `composer install`, `cp .env.example .env`, `php artisan key:generate`, `php artisan migrate:fresh --seed`, `npm install`, `npm run build`, `php artisan serve`.
- **E2** Cualquier comando que falle, pida datos interactivos no documentados o requiera un servicio externo invalida el arranque.
- **E3** No se arranca ningún proceso adicional (colas, scheduler, Vite en modo dev) salvo que el README lo indique como comando de arranque.
- **E4** Las credenciales de X2 deben funcionar tal cual. Si no hay forma de entrar como admin o como cliente, todo lo que esté detrás de ese login cuenta como no entregado.

### Qué significa "funciona"

- **F1** Un criterio pasa solo si el flujo completo se realiza en el navegador, de principio a fin, con el resultado esperado. Funcionar a medias es no funcionar.
- **F2** Un error 500, una página en blanco, una excepción en `storage/logs/laravel.log` durante el flujo o un error de JavaScript que impida la acción hacen fallar el criterio.
- **F3** Lo que exista en el código pero no sea accesible desde la interfaz (sin menú, sin enlace, sin botón) no cuenta.
- **F4** Lo que falle con los datos del seeder pero funcione con otros datos, falla.
- **F5** Se prueba en Chrome de escritorio y con la vista móvil de 375 px para P8.
- **F6** En cada página evaluada se revisa la pestaña Red de DevTools: una imagen rota (404), una petición a un dominio externo o texto de relleno visible hacen fallar todas las pruebas de esa página.

### Límites

- **L1** Tiempo máximo por ejecución: 4 horas de reloj. Al llegar se detiene el agente, se hace commit y se evalúa lo que haya.
- **L2** Los tests se ejecutan con `php artisan test` en el clon limpio. Se anotan los que pasan y los que fallan; una suite roja no invalida la entrega, pero penaliza.
- **L3** Calidad estática: el evaluador ejecuta Larastan nivel 5 en una copia aparte. El número de errores se registra como métrica.

# Integración directa de SNP

Implementada y probada el 30/09/2026. La fuente de la aplicación es SNP; no se consulta La Cúpula desde `src/`.

## Cómo funciona

`SNP → servidor fito-snp → normalización y caché privada → web`.

El servidor envía el formulario normal de `https://snpgalaxy.com/usuario/login`, con `email` y `password`. Sigue el enlace «España - SNP» que devuelve la cuenta y obtiene la URL de competición del iframe. Mantiene en memoria las cookies de SNP y el contexto de sesión. No usa Chrome ni Google para este acceso. Renueva el contexto cada 15 minutos cuando hay consultas; una sesión rechazada se invalida. Los fallos de autenticación tienen un minuto de espera antes del siguiente intento. Nunca se siguen redirecciones fuera de los dos hosts SNP, ni se intenta resolver una verificación automáticamente.

Las credenciales permanecen en `.env.local` en desarrollo o en el gestor de secretos del alojamiento. No se incluyen en JSON de la aplicación, cachés deportivas, registros ni JavaScript del navegador. El archivo de sesión manual anterior es una alternativa; no es necesario cuando están configurados `SNP_EMAIL` y `SNP_PASSWORD`.

## Consultas que usa la web

Host original: `https://seriesnacionalesdepadel.snpgalaxy.com`. Las consultas AJAX son POST de formulario URL encoded. Se añaden en el servidor el contexto `/s_:…` y `idtemporadaG` obtenidos de SNP; sus valores no se exponen en la web.

| Ruta | Parámetros propios | Uso |
|---|---|---|
| `competicion/ajaxGetFasesByZona` | `zona`, `competicion` | Fases disponibles |
| `competicion/ajaxGetCategoriaPadreCompeticion` | `fase` | Masculino/femenino |
| `competicion/ajaxGetByCategoriaPadre` | `fase`, `idcategoria` | Grupos |
| `competicion/ajaxGetClubByFaseGrupo` | `fase`, `idgrupo` | Divisiones o clubes |
| `competicion/ajaxGetDivisiones` | `fase`, `club`, `grupo` | Divisiones de un club |
| `competicion/ajaxGetClasificacion` | `iddivision` | Clasificación, sin recalcular el orden |
| `competicion/ajaxAccionesResultadosJornada` | `iddivision`, `idfase`, `idclub`, `idcategoria` | Calendario de toda la división |
| `competicion/ajaxGetResultadosJornada` | Los anteriores y `ronda` | Resultados de jornada |
| `jugador/ajaxGetAllJugadores` | `idequipo`, `num_pagina`, `limite_pagina=20`, `filtro`, `update`, `desde_clasificacion_final` | Plantilla paginada, ranking y foto |
| `ranking/ajaxGetCategoriaGrupoByJugador` | `idjugador` | Grupos del jugador |
| `ranking/ajaxGetByJugadorAndGrupo` | `idjugador`, `idgrupo` | Puntos e historial actual/anterior |

Se lee también el HTML original de `competicion/view/1` para las zonas, `equipo/view/{id}` para el nombre de equipo, `ranking/menu_puntuacion/{id}` y `enfrentamiento/edit/{id}/verG` para las actas. Las alineaciones, IDs y sets del acta se normalizan en el servidor. No se usan endpoints de edición, inscripción o contacto.

## Cobertura de la web

- Fito A: equipo `7778`, división `2318`.
- Fito B: equipo `803902`, división `2326`.
- Cádiz `128`, fase regular `269`, masculino `15`, Future `20`.
- Inicio y resumen: clasificación, plantilla y siguiente encuentro del mismo repositorio vivo.
- Jornadas propias: se filtra el calendario por ID de Fito; no se reutiliza el calendario de otro equipo.
- Competición: filtros SNP, clasificación, búsqueda de equipos y resultados por jornada.
- Equipo externo: plantilla completa, fotos, puntos, fichas y calendario al abrirlo desde su división.
- Jugador: mismo conector genérico para cualquier ID devuelto por SNP, con historial actual/anterior y grupos disponibles. No hay jugadores especiales codificados en el conector.
- Actas: tabla con dos filas por pareja, tres columnas de sets, puntos y enlaces a jugadores.
- Creador de parejas: conserva sus reglas y usa los puntos de la plantilla actualizada.

Solo se conserva el modelo deportivo. Campos de contacto, DNI y otras propiedades privadas de la respuesta SNP se descartan. Una foto inexistente utiliza iniciales; los puntos vacíos se normalizan a cero. Los horarios sin zona se interpretan como hora de España peninsular, incluyendo el cambio de horario de invierno.

## Actualización y fallos

Las pantallas abiertas revisan los datos cada minuto. Las consultas del servidor reutilizan la caché durante `SNP_CACHE_SECONDS` (60 por defecto), deduplican consultas simultáneas idénticas y escriben por sustitución de archivo. Los errores 502/503/504 de lectura tienen un único reintento. Un fallo no sustituye una consulta completa por una respuesta incompleta. Se sirve la última caché con aviso y fecha; si no existe, A y B pueden conservar su captura original, identificada como datos guardados. Para otros equipos sin caché se muestra el error.

Este comportamiento no prueba que SNP publique un resultado inmediatamente después de finalizar un partido. El dato aparece cuando SNP lo publica y llega la siguiente consulta. No hay streaming ni una garantía pública de disponibilidad de estos endpoints internos.

`pnpm snp:sync` actualiza A y B sin abrir la web. No se ha instalado ninguna tarea programada en el ordenador ni se ha desplegado un servidor.

## Despliegue recomendado

Para una primera publicación, usar un servidor Node con un volumen persistente, por ejemplo un servicio en Render o un VPS. Configurar:

```dotenv
SNP_EMAIL=…
SNP_PASSWORD=…
SNP_CACHE_SECONDS=60
SNP_CACHE_DIR=/ruta/privada/persistente/snp-cache
POSITIONS_ADMIN_PASSWORD=…
PLAYER_POSITIONS_FILE=/ruta/privada/persistente/positions.json
```

Instalar dependencias, ejecutar `pnpm build` y arrancar Next escuchando en la interfaz/puerto indicados por el alojamiento: `pnpm exec next start --hostname 0.0.0.0 --port "$PORT"`. El script `pnpm start` actual escucha únicamente en localhost, apropiado detrás de un proxy local. Exigir HTTPS en el sitio público. El volumen de caché debe quedar fuera de `public/`, sin acceso web a sus archivos.

Para sincronizar incluso sin visitantes, programar `pnpm snp:sync` cada cinco minutos en el mismo servidor, con las mismas variables y el mismo volumen. No usar un disco efímero separado para el trabajo. En Vercel habría que sustituir la caché de archivos por almacenamiento persistente externo; esta implementación no debe desplegarse allí suponiendo que los archivos sobreviven.

Las posiciones editadas por el club requieren almacenamiento persistente: no son una caché recuperable desde SNP. En Render gratuito se perderían tras reinicios o despliegues si no se añade un almacenamiento externo. Un cron separado de Render no puede acceder al disco del servicio web.

Antes de uso sostenido, confirmar las condiciones y límites de consulta con SNP. Los endpoints internos pueden cambiar. Si SNP exige CAPTCHA, un segundo factor o una verificación, se detiene el acceso automático y se conserva la última consulta; hará falta intervención del administrador. No se ha probado todavía el funcionamiento durante varios días ni desde la IP de un alojamiento.

## Verificación

Las pruebas de integración contra SNP han obtenido las dos plantillas de 16 jugadores, seis equipos de Segunda Future, cinco de Décima Future, diez jornadas en ambas, 30 encuentros de la división A y 20 de la B, acta `55252` con cinco partidos y sus sets, perfiles propios y de un jugador de Arcos. Se ha obtenido la plantilla de Arcos con 21 jugadores, validando una segunda página. Se ha consultado una división femenina; los filtros sin divisiones disponibles devuelven una selección vacía y permiten cambiar de fase/grupo.

Las 14 pruebas unitarias pasan: reglas del laboratorio, respaldo de A/B, orden de clasificación y empate, fechas de verano/invierno, cero puntos, descarte de campos privados, estado de partido, sets incompletos e impedir reenviar credenciales a un host externo. Se verificaron 29 rutas de la web y cuatro rutas inválidas con su página 404. Lint, TypeScript y compilación de producción pasan. La compilación se arrancó temporalmente en localhost:3001 y obtuvo de SNP una plantilla externa de 21 jugadores con `source=live`, sin datos de respaldo. Se escanearon 69 archivos de cliente/caché: no contenían el correo ni la contraseña configurados. La instancia temporal de producción se detuvo; la web de desarrollo continúa en el puerto 3000.

# fito-snp

Web de Escuela Fito Raya para sus equipos A (Segunda División Future) y B (Décima División Future), con integración directa de SNP desde el servidor. Consulta competición, equipos, plantillas, fotos, ranking, jornadas y actas. Las capturas originales del 30/09/2026 se conservan solo como respaldo identificado.

Configura `SNP_EMAIL` y `SNP_PASSWORD` en `.env.local`, reinicia el servidor y abre `/conexion` para comprobar el acceso. Usa las credenciales propias de SNP; no hace falta Google ni mantener Chrome abierto. [Detalles de integración, límites y despliegue](docs/integracion-snp.md).

## Arranque

Requiere Node.js 24 y pnpm 11.19.0. `.node-version` fija Node 24.19.0 y `pnpm-lock.yaml` permite reproducir las versiones instaladas.

```sh
pnpm install --frozen-lockfile
# Copia .env.example a .env.local y configura el acceso propio de SNP.
pnpm dev
```

Abre http://127.0.0.1:3000. Para producción local: `pnpm build` y `pnpm start`.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
# Con el servidor arrancado:
node scripts/check-routes.mjs
```

## Estructura

- `src/app`: App Router, diseño compartido y rutas dinámicas.
- `src/domain/types.ts`: contratos de equipos, jugadores, parejas y jornadas.
- `src/domain/rules.ts`: funciones puras para puntos, orden, posiciones, duplicados, asignaciones e intercambios.
- `src/data/snp-snapshot.ts`: 16 jugadores por equipo, clasificaciones oficiales y calendario de fase regular (10 encuentros A, 8 B; B sin encuentro en jornadas 1 y 6).
- `docs/integracion-snp.md`: arquitectura, consultas y despliegue. Las evidencias y capturas de investigación se conservan localmente y se excluyen de Git.
- `src/data/mock.ts`: antigua muestra ficticia, fuera del adaptador y de la interfaz.
- `src/data/repository.ts`: interfaz asíncrona y adaptador de la consulta SNP; sustituible por una base de datos.
- `src/components/sports.tsx`: presentación deportiva compartida por ambos equipos.
- `src/components/lineup`: laboratorio interactivo y selector accesible mediante un diálogo nativo.
- `src/lib/format.ts`: fechas en zona Europe/Madrid e iniciales.
- `tests`: reglas deportivas, operaciones e integridad del conjunto SNP.
- `public`: logo original, referencia de equipación y favicon.

## Rutas

- `/`: entrada con los dos equipos y próximas jornadas.
- `/equipos/a` y `/equipos/b`: resumen.
- `/equipos/[teamId]/clasificacion`: clasificación independiente.
- `/equipos/[teamId]/plantilla`: ranking de jugadores por puntos SNP.
- `/equipos/[teamId]/jornadas`: pendientes y resultados.
- `/equipos/[teamId]/jornadas/[fixtureId]`: detalle de cinco partidos o preparación de la próxima jornada.
- `/equipos/[teamId]/parejas`: laboratorio de alineaciones.
- `/competicion`: explorador de zonas, divisiones, clasificación y jornadas de SNP.
- `/competicion/equipos/[id]`: plantilla de cualquier equipo consultado.
- `/competicion/jugadores/[id]`: ficha y puntos de un jugador.
- `/competicion/actas/[id]`: detalle del encuentro y sus sets.
- `/conexion`: estado del acceso a SNP.

Los identificadores ajenos al equipo o inexistentes muestran la página 404.

## Laboratorio

Todos los jugadores están seleccionados inicialmente. Los checkboxes representan una selección temporal; no existe disponibilidad ni estado activo en la ficha del jugador. Se permite cualquier cantidad de seleccionados.

Para formar una pareja, pulsa dos jugadores sin pareja: se colocan juntos en una pareja vacía de la alineación y se ordenan por puntos SNP. Pulsar otra vez el primer jugador cancela la selección. También puedes pulsar un jugador y después un hueco, arrastrar jugadores en escritorio, o pulsar un hueco y elegir en el selector. Los jugadores asignados tienen un botón de intercambio; pulsa ese botón y después el hueco de destino. Mover sobre un hueco ocupado intercambia los jugadores si ambos estaban asignados; colocar un jugador libre devuelve el anterior a la zona de jugadores sin pareja. Nunca se duplica un jugador. Las fotos de SNP aparecen en jugadores libres, parejas y selector, con iniciales cuando no hay una foto disponible.

Desmarcar retira al jugador de su pareja y de la zona de creación. Quitar, deshacer pareja y vaciar alineación permiten empezar de nuevo. Los puntos se recalculan inmediatamente. Los conflictos de posición se muestran sin bloquear. El selector admite teclado, Escape y mantiene el foco dentro del diálogo. En móvil la convocatoria se puede plegar y los huecos se apilan.

La selección y alineación viven en memoria de React y se reinician al abandonar el laboratorio o recargar. No se guardan propuestas en esta fase.

Al final del laboratorio hay un editor protegido de posiciones. La contraseña se configura únicamente en `POSITIONS_ADMIN_PASSWORD` en el servidor. Los cambios se guardan en `.club-private/positions.json` (excluido de Git), separado de SNP, y sobreviven a recargas y actualizaciones de la fuente. Configura `PLAYER_POSITIONS_FILE` en un volumen persistente al desplegar. La contraseña no se guarda en el navegador; se vuelve a verificar al guardar. Al seleccionar un revés se destacan los derechas en verde y los jugadores de ambos lados en amarillo; con un derecha se destacan los reveses. Las sugerencias no impiden probar otras parejas.

## Reglas SNP

La suma de los dos jugadores determina los puntos de pareja. `sortPairs` ordena de mayor a menor sin mutar el estado y usa el ID estable del hueco original para desempates. Las parejas incompletas muestran la suma provisional del jugador presente; el orden se actualiza durante la edición.

`MATCH_VALUES` centraliza `[3, 3, 2, 2, 2]`. La posición en el orden asigna el valor del partido. `matchPoints` adjudica ese valor al ganador; `fixtureScore` suma los cinco partidos y exige cinco índices únicos. Para encuentros importados se conserva el marcador publicado por SNP. El detalle distingue local y visitante.

Las clasificaciones conservan el orden, victorias y derrotas publicados por SNP, sin recalcular desempates. El acta del A ante C.D VibraPadel (26/09) suma 6–6; la tabla oficial registra una victoria para A y se conserva ese dato.

Hay 3 jugadores A y 7 B con campo de puntuación vacío en SNP. Por indicación expresa del usuario, se importan como 0 puntos. Las evidencias originales conservan el campo vacío como `null`. Todos tienen posición `null` porque SNP no la muestra. Una pareja con puntos desconocidos muestra «Sin dato» y queda al final en orden provisional. Las sumas conocidas se redondean a dos decimales.

Se verificaron las fechas y los horarios de los 18 encuentros en el calendario y sus fichas. Las sedes no verificadas se muestran por confirmar. Se importaron los cinco partidos, ganadores y sets del único encuentro disputado del A. No hay partidos disputados del B en esta consulta.

## Próximas fases

La integración SNP y la caché están implementadas. `pnpm snp:sync` permite actualizar A y B desde una tarea programada del servidor. `ClubRepository` conserva las reglas y la UI separadas del acceso externo. Quedan para otra fase el almacenamiento de propuestas, generador automático y panel de administración.

## GitHub y configuración privada

Repositorio: https://github.com/faliideusto/Equipo-P-del-Fito-Raya

Despliegue gratuito: [guía de Render](docs/despliegue-render.md). La configuración está en `render.yaml`.

GitHub almacena el código; el despliegue de esta aplicación necesita un servidor Node. El workflow de GitHub Actions ejecuta lint, TypeScript, pruebas y compilación sin credenciales ni consultas autenticadas a SNP.

Antes de subir cambios, ejecuta `node scripts/check-repository.mjs`. Comprueba los archivos que entrarían en Git y detecta credenciales configuradas y algunos formatos comunes de claves. No sustituye una revisión manual de los cambios.

No publiques `.env.local`, `.snp-private/` ni `.snp-cache/`. Están excluidos de Git, junto con las capturas y archivos de investigación. `.env.example` contiene únicamente los nombres de las variables. En el alojamiento configura `SNP_EMAIL` y `SNP_PASSWORD` como secretos privados del servidor; no uses variables `NEXT_PUBLIC_` para credenciales.

## Diseño

Azul de pista como acento principal, blanco roto y grafito. Logo oficial sin reinterpretación, granate discreto para identificar el equipo B, amarillo en el detalle de la pelota. La pista del inicio está dibujada con CSS y no necesita recursos externos. Tipografía del sistema, sin descargar fuentes ni llamadas a APIs de terceros.
# Cuentas de jugadores

El menú «Mi perfil» permite registrarse con correo, contraseña y posición en pista,
iniciar sesión y vincular la ficha automáticamente con el acceso propio de SNP.
La contraseña SNP se usa solo para comprobar la identidad y no se conserva.
La posición del usuario sustituye la anterior; el entrenador puede editarla después.

La instalación requiere `supabase/accounts.sql` y las variables de Supabase ya
utilizadas por el club. El proyecto actual usa registro directo sin confirmación
de correo por decisión del propietario. Detalles: [cuentas](docs/cuentas.md).


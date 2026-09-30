# Despliegue gratuito en Render

El repositorio incluye `render.yaml` con un Web Service Node en el plan Free, región Frankfurt. No crea servicios de pago ni una base de datos Render que caduque a los 30 días.

1. En Render, conecta el repositorio `faliideusto/Equipo-P-del-Fito-Raya` y crea un Blueprint desde `main` (o un Web Service usando los comandos de `render.yaml`).
2. Configura `SNP_EMAIL`, `SNP_PASSWORD` y `POSITIONS_ADMIN_PASSWORD` como variables privadas. Copia sus valores de tu archivo local privado; no los publiques en GitHub. No hace falta cargar cookies ni credenciales de Google.
3. Verifica que el plan sea **Free** antes de crear el servicio.
4. Espera a que termine el despliegue. Comprueba `/api/health`, `/conexion`, los equipos A/B y una plantilla externa desde Competición.

El servidor escucha en `0.0.0.0` y usa el puerto `PORT` de Render. El comando local `pnpm start` sigue disponible.

Si creas el Web Service manualmente, configura estos valores en su panel:

- **Build Command:** `corepack pnpm install --frozen-lockfile && corepack pnpm build`
- **Start Command:** `corepack pnpm start:render`
- **Environment → NODE_VERSION:** `24.19.0`

Corepack ejecuta pnpm directamente, sin `corepack enable`, que intenta escribir enlaces en carpetas protegidas de Render. Para un servicio existente, cambia estos valores en el panel: modificar `render.yaml` no actualiza un servicio creado manualmente. Guarda los cambios y usa **Manual Deploy → Deploy latest commit**.

## Almacenamiento

Ejecuta también `supabase/coach-password.sql` antes de desplegar la opción de cambio de contraseña. La contraseña inicial procede de `POSITIONS_ADMIN_PASSWORD`; tras cambiarla, se valida únicamente la huella scrypt guardada en Supabase. La contraseña nueva no se guarda en claro ni se devuelve al navegador. El cambio afecta a ambos equipos y al editor de posiciones. El administrador del alojamiento y la base de datos conserva capacidad técnica de restablecer el acceso; para una administración exclusiva, transfiere esos servicios al entrenador.

Para activar el archivo privado de alineaciones del entrenador, ejecuta también `supabase/lineups.sql` en el SQL Editor del proyecto existente. Usa la misma contraseña de `POSITIONS_ADMIN_PASSWORD`. La tabla `saved_lineups` tiene RLS y no concede acceso público; el servidor verifica la contraseña en cada consulta, guardado y eliminación. Las propuestas de A y B se almacenan por separado. El navegador mantiene la contraseña solo mientras el apartado está abierto y no guarda las alineaciones en almacenamiento local.

En Supabase crea un proyecto del plan Free y ejecuta `supabase/positions.sql` en su SQL Editor. En Render configura `SUPABASE_URL` (URL del proyecto) y `SUPABASE_SECRET_KEY` (clave Secret o la antigua service_role). No uses la clave pública ni variables `NEXT_PUBLIC_`. Solo el servidor accede a esta tabla; RLS y permisos impiden la lectura/escritura desde clientes públicos.

Las posiciones se guardan mediante upsert por jugador, sin reemplazar las de otros equipos. El almacenamiento local sigue siendo la alternativa de desarrollo cuando no están configuradas las variables de Supabase. Los datos actuales del archivo privado se pueden importar con el script `pnpm positions:migrate` antes del despliegue. Supabase Free puede pausar proyectos inactivos y tiene límites de uso; no garantiza disponibilidad continua.

Render Free duerme tras 15 minutos sin tráfico y borra archivos locales al dormir, reiniciar o desplegar. La caché SNP es recuperable desde la fuente. Las posiciones del club necesitan una base de datos externa para conservarse; no deben tratarse como caché. Sin almacenamiento persistente externo, la edición se bloquea en Render para evitar perder cambios.

No se programan solicitudes artificiales para mantener el servidor despierto. Los resultados se actualizan al consultar la web, según lo que SNP haya publicado. Configuramos una caché de cinco minutos para reducir consultas a SNP.

Condiciones oficiales: https://render.com/docs/free

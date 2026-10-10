# Despliegue en Vercel

El proyecto `fito-snp` está conectado al repositorio GitHub
`faliideusto/Equipo-P-del-Fito-Raya`. Cada push a `main` inicia un despliegue
de producción y actualiza `https://fito-snp.vercel.app` cuando la compilación
termina correctamente. Las variables privadas se conservan en Vercel.

Importa este proyecto como Next.js con Node 24. `vercel.json` fija pnpm 11.19.0,
la región Frankfurt y un máximo de 300 segundos por función para las consultas SNP.

Configura como variables privadas de Production: `SNP_EMAIL`, `SNP_PASSWORD`,
`POSITIONS_ADMIN_PASSWORD`, `SUPABASE_URL` y `SUPABASE_SECRET_KEY`.
Configura `SNP_CACHE_SECONDS=300`. No publiques credenciales con `NEXT_PUBLIC_`.

Usa las tablas del proyecto Supabase existente. Vercel requiere Supabase para
posiciones, alineaciones, MVP, cuentas y contraseña del entrenador. No se guardan
datos duraderos del club en el sistema de archivos de las funciones.

La caché SNP usa el Data Cache de Next.js en Vercel y conserva una copia temporal
en `/tmp` por instancia. Se usa `unstable_cache` por compatibilidad con el modelo
actual de renderizado; migrar a `use cache` requiere activar Cache Components.
Solo se almacenan respuestas deportivas, nunca las cookies de acceso SNP.
Los errores de escritura de caché no descartan una respuesta correcta de SNP.
La sesión SNP se renueva con las credenciales privadas en cada instancia cuando
es necesario. No hace falta navegador ni Playwright en producción.

`.vercelignore` excluye secretos, sesiones, datos privados y evidencias locales
también de las subidas realizadas con la CLI. La carpeta `.vercel` no entra en Git.

Comprueba `/api/health`, `/acceso`, el acceso privado, `/conexion`, las plantillas
y la lectura de posiciones después del despliegue. La sincronización ocurre al
consultar los datos; no se necesita una tarea cron para mantener el servidor activo.

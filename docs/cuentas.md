# Cuentas y vinculación SNP

## Activación

1. Ejecutar `supabase/accounts.sql` en el SQL Editor del proyecto Supabase. Requiere la tabla `player_positions`, ya utilizada por el editor del entrenador. La operación es repetible.
2. Supabase → Authentication → Sign In / Providers: permitir Email y nuevos registros. La confirmación de correo está desactivada por petición del propietario: el registro abre la sesión directamente.
3. Authentication → URL Configuration: Site URL `https://escuelafitoraya.onrender.com/acceso`; permitir como Redirect URL `https://escuelafitoraya.onrender.com/acceso` y, para pruebas locales, `http://127.0.0.1:3000/acceso`.
4. No hace falta SMTP para el registro directo. Si se incorpora recuperación de contraseña por email o confirmación en el futuro, configurar un proveedor SMTP propio.
5. Render ya necesita `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. No hay claves nuevas en el navegador.

## Flujo

La cuenta de esta web se registra mediante Supabase Auth con correo, contraseña y posición. El registro abre la sesión sin confirmar el correo, de acuerdo con la decisión del propietario. El correo declarado no prueba identidad: solo la vinculación validada con SNP prueba la ficha deportiva. El servidor valida la sesión con Auth; las cookies de acceso y renovación son HttpOnly, SameSite=Lax y Secure en producción. No se almacenan contraseñas de la web en nuestras tablas.

Para vincular SNP, el usuario introduce el correo y contraseña propios de SNP. El servidor inicia una sesión temporal con el flujo ya comprobado y lee solo `userG.id` y `rankingJugadorNacional.idjugador` del documento autenticado. No acepta un ID de jugador enviado por el navegador ni evalúa JavaScript de SNP. Cookies y contraseña SNP no se escriben en archivos, logs o base de datos. Google, CAPTCHA y otras verificaciones no se eluden: el acceso requiere contraseña propia y una ficha identificable.

La vinculación persiste en `player_accounts`, con una cuenta por jugador y usuario SNP. La función `link_player_account` guarda la vinculación y sobrescribe la posición previa en una sola transacción. Las ediciones posteriores del entrenador funcionan como antes. Cambiar la posición desde Mi perfil vuelve a aplicar la elección del usuario. Desvincular elimina la asociación, conservando la posición deportiva actual.

El historial de Mi perfil se consulta con la conexión SNP del club; no requiere conservar contraseñas SNP de cada usuario. La aportación al A/B usa las mismas reglas de actas y calendario que el ranking del equipo. Se consulta cada minuto mientras el perfil está visible y se indica si las actas son parciales o guardadas.

## Límites y comprobaciones

Los endpoints privados verifican la sesión y obtienen la cuenta del servidor; no confían en IDs de usuario enviados por el cliente. RLS deniega acceso directo a las tablas a clientes anon/authenticated; solo el servidor puede ejecutar la función de vinculación. Se verifican origen, tamaño, posición y límites de intentos. Los límites de SNP son por cuenta de esta web y proceso; para despliegues con varias instancias añadir un limitador compartido.

No se ha confirmado que SNP disponga de OAuth público para aplicaciones externas. El parser falla si cambia la estructura o la cuenta no tiene ficha. La consulta de identidad se ha verificado con una cuenta propia de SNP; otras variantes necesitan pruebas. No hay recuperación de contraseña en la interfaz de esta primera versión; un administrador puede enviar el restablecimiento desde Supabase Auth.

# Cuentas y vinculación SNP

## Activación

1. Ejecutar `supabase/accounts.sql` en el SQL Editor del proyecto Supabase. Requiere la tabla `player_positions`, ya utilizada por el editor del entrenador. La operación es repetible.
2. Supabase → Authentication → Sign In / Providers: permitir Email y nuevos registros. La confirmación de correo está desactivada por petición del propietario: el registro abre la sesión directamente.
3. Authentication → URL Configuration: Site URL `https://escuelafitoraya.onrender.com/acceso`; permitir como Redirect URL `https://escuelafitoraya.onrender.com/acceso` y, para pruebas locales, `http://127.0.0.1:3000/acceso`.
4. No hace falta SMTP para el registro directo. Si se incorpora recuperación de contraseña por email o confirmación en el futuro, configurar un proveedor SMTP propio.
5. Render ya necesita `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. No hay claves nuevas en el navegador.

## Flujo

El registro exige correo y contraseña de la web, posición y acceso propio a SNP. Antes de crear ningún usuario, se valida SNP y se detecta su ficha; una contraseña SNP incorrecta o una cuenta sin ficha impiden el registro. El servidor crea el usuario con Auth Admin, lo vincula mediante la RPC y abre su sesión. Si la vinculación falla (incluida una ficha ya vinculada), se elimina únicamente el usuario nuevo creado por esa petición. Si falla el inicio de sesión después de vincular, se invita a entrar de nuevo con la cuenta ya creada. El registro abre la sesión sin confirmar el correo, de acuerdo con la decisión del propietario. El correo declarado no prueba identidad: solo la vinculación validada con SNP prueba la ficha deportiva. El servidor valida la sesión con Auth; las cookies de acceso y renovación son HttpOnly, SameSite=Lax y Secure en producción. No se almacenan contraseñas de la web en nuestras tablas.

Para vincular SNP, el usuario introduce el correo y contraseña propios de SNP. El servidor inicia una sesión temporal con el flujo ya comprobado y lee solo `userG.id` y `rankingJugadorNacional.idjugador` del documento autenticado. No acepta un ID de jugador enviado por el navegador ni evalúa JavaScript de SNP. Cookies y contraseña SNP no se escriben en archivos, logs o base de datos. Google, CAPTCHA y otras verificaciones no se eluden: el acceso requiere contraseña propia y una ficha identificable.

La vinculación persiste en `player_accounts`, con una cuenta por jugador y usuario SNP. La función `link_player_account` guarda la vinculación y sobrescribe la posición previa en una sola transacción. Las ediciones posteriores del entrenador funcionan como antes. Cambiar la posición desde Mi perfil vuelve a aplicar la elección del usuario. Desvincular elimina la asociación, conservando la posición deportiva actual.

El historial de Mi perfil se consulta con la conexión SNP del club; no requiere conservar contraseñas SNP de cada usuario. La aportación al A/B usa las mismas reglas de actas y calendario que el ranking del equipo. Se consulta cada minuto mientras el perfil está visible y se indica si las actas son parciales o guardadas.

## Límites y comprobaciones

El acceso a todas las páginas y APIs de datos requiere una sesión de jugador validada con Supabase o una sesión firmada del entrenador en el servidor. Sin sesión, las páginas redirigen a `/acceso` y las APIs responden 401. El registro/inicio de sesión, la comprobación de salud de Render y los recursos necesarios para el formulario quedan disponibles. La pantalla de acceso no muestra el menú de la aplicación. El servidor renueva las cookies cuando la sesión caduca y bloquea los datos si Auth no está disponible.

Los endpoints privados verifican la sesión y obtienen la cuenta del servidor; no confían en IDs de usuario enviados por el cliente. RLS deniega acceso directo a las tablas a clientes anon/authenticated; solo el servidor puede ejecutar la función de vinculación. Se verifican origen, tamaño, posición y límites de intentos. Los límites de SNP son por cuenta de esta web y proceso; para despliegues con varias instancias añadir un limitador compartido.

No se ha confirmado que SNP disponga de OAuth público para aplicaciones externas. El parser falla si cambia la estructura o la cuenta no tiene ficha. La consulta de identidad se ha verificado con una cuenta propia de SNP; otras variantes necesitan pruebas. No hay recuperación de contraseña en la interfaz de esta primera versión; un administrador puede enviar el restablecimiento desde Supabase Auth.

## Entrenador

El usuario `fitoraya` entra con la contraseña inicial configurada en `POSITIONS_ADMIN_PASSWORD`, o la contraseña cambiada y guardada en `coach_credentials`. No necesita ficha SNP. Su cookie HttpOnly firmada dura ocho horas; la firma usa la clave privada del servidor y se valida frente a la revisión actual de la contraseña. Cambiarla invalida todas las sesiones anteriores. `/entrenador` reúne posiciones, alineaciones privadas, MVP y cambio de contraseña. Los controles también permanecen en sus secciones habituales, sin solicitar contraseñas repetidas. Las otras cuentas no ven estos controles y sus peticiones a las APIs de edición se rechazan aunque conozcan la contraseña anterior. No hace falta SQL nuevo: se utilizan las tablas existentes.

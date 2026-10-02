# Cuentas y vinculación SNP

## Activación

1. Ejecutar `supabase/accounts.sql` en el SQL Editor del proyecto Supabase. Requiere la tabla `player_positions`, ya utilizada por el editor del entrenador. La operación es repetible.
2. Supabase → Authentication → Sign In / Providers: permitir Email y nuevos registros. La confirmación de correo está desactivada por petición del propietario: el registro abre la sesión directamente.
3. Authentication → URL Configuration: Site URL `https://escuelafitoraya.onrender.com/acceso`; permitir como Redirect URL `https://escuelafitoraya.onrender.com/acceso` y, para pruebas locales, `http://127.0.0.1:3000/acceso`.
4. No hace falta SMTP para el registro directo. Si se incorpora recuperación de contraseña por email o confirmación en el futuro, configurar un proveedor SMTP propio.
5. Render ya necesita `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. No hay claves nuevas en el navegador.

## Flujo

El registro pide correo y contraseña de la web, posición, equipo A/B y jugador de la plantilla. El selector ofrece búsqueda por nombre sin distinguir acentos. Las fichas ya asociadas se muestran como no disponibles. El servidor valida la selección contra la plantilla actual antes de crear el usuario con Auth Admin, guarda la asociación mediante la RPC y abre la sesión. La restricción única de player_id protege también frente a dos registros simultáneos y jugadores compartidos entre A/B. Si la asociación falla, se elimina únicamente el usuario nuevo creado por esa petición. Si falla el inicio de sesión después de asociar, se invita a entrar de nuevo con la cuenta ya creada.

No se solicita acceso personal a SNP y esta selección no prueba la identidad deportiva: es una asociación declarada por el usuario, como ha solicitado el propietario. Las cuentas previas conservan sus fichas. El correo no se confirma por decisión del propietario. Las cookies de acceso y renovación son HttpOnly, SameSite=Lax y Secure en producción.

La asociación persiste en player_accounts. snp_user_id es opcional y queda null para selecciones de plantilla; no se inventa un ID de cuenta SNP. Para instalaciones anteriores ejecutar supabase/roster-registration.sql (ya aplicado al proyecto actual). La función link_player_account guarda la asociación y sobrescribe la posición anterior en una transacción. Las ediciones posteriores del entrenador tienen prioridad hasta que el jugador vuelva a guardar su posición. Las cuentas antiguas sin ficha disponen del mismo selector en Mi perfil.

El historial de Mi perfil se consulta con la conexión SNP del club; no requiere conservar contraseñas SNP de cada usuario. La aportación al A/B usa las mismas reglas de actas y calendario que el ranking del equipo. Se consulta cada minuto mientras el perfil está visible y se indica si las actas son parciales o guardadas.

## Límites y comprobaciones

El acceso a todas las páginas y APIs de datos requiere una sesión de jugador validada con Supabase o una sesión firmada del entrenador en el servidor. Sin sesión, las páginas redirigen a `/acceso` y las APIs responden 401. El registro/inicio de sesión, el selector público limitado de jugadores de A/B, la comprobación de salud de Render y los recursos necesarios para el formulario quedan disponibles. La pantalla de acceso no muestra el menú de la aplicación. El servidor renueva las cookies cuando la sesión caduca y bloquea los datos si Auth no está disponible.

Los endpoints privados verifican la sesión y obtienen la cuenta del servidor; no confían en IDs de usuario enviados por el cliente. RLS deniega acceso directo a las tablas a clientes anon/authenticated; solo el servidor puede ejecutar la función de vinculación. Se verifican origen, tamaño, posición y límites de intentos. Los límites de registro son por correo de esta web y proceso; para despliegues con varias instancias añadir un limitador compartido.

Las contraseñas de la web solo deben ser no vacías; no hay mínimo de longitud ni requisitos de composición. Para las cuentas nuevas el servidor deriva una credencial de proveedor con SHA-256 y un prefijo fijo (72 caracteres), y Supabase almacena su hash habitual. La contraseña original no se guarda. El inicio de sesión prueba esa representación y, ante credenciales incorrectas, admite la contraseña directa para cuentas anteriores o restablecidas desde Supabase. Esta representación es específica de la web: una cuenta nueva no se autentica directamente en Supabase con la contraseña original. Los formularios mantienen límites de tamaño para acotar las peticiones. El entrenador también puede elegir una contraseña corta; se mantiene su almacenamiento con scrypt.

El botón Cerrar sesión está en la cabecera de todas las páginas privadas, además de Mi perfil y el panel de entrenador. Elimina las cookies y cierra la sesión local de Auth antes de regresar a /acceso.

No hay recuperación de contraseña en la interfaz de esta primera versión; un administrador puede enviar el restablecimiento desde Supabase Auth.

## Entrenador

El usuario `fitoraya` entra con la contraseña inicial configurada en `POSITIONS_ADMIN_PASSWORD`, o la contraseña cambiada y guardada en `coach_credentials`. No necesita ficha SNP. Su cookie HttpOnly firmada dura ocho horas; la firma usa la clave privada del servidor y se valida frente a la revisión actual de la contraseña. Cambiarla invalida todas las sesiones anteriores. `/entrenador` reúne posiciones, alineaciones privadas, MVP y cambio de contraseña. Los controles también permanecen en sus secciones habituales, sin solicitar contraseñas repetidas. Las otras cuentas no ven estos controles y sus peticiones a las APIs de edición se rechazan aunque conozcan la contraseña anterior. No hace falta SQL nuevo: se utilizan las tablas existentes.

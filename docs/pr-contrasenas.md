# Cambio y recuperación de contraseña — pendiente de revisión

Rama: `feature/cambio-recuperacion-contrasena`. **No fusionar hasta completar los pasos de Supabase.**

## Qué añade

1. **Mi perfil → «Cambiar contraseña»**: contraseña actual, nueva y repetición. El servidor comprueba la actual iniciando sesión, guarda la nueva con la misma credencial derivada (`providerPassword`) y renueva las cookies. Funciona también con cuentas antiguas. No disponible para la cuenta de visitante; el entrenador sigue usando `/entrenador`.
2. **Acceso → «¿Has olvidado tu contraseña?»**: pide el correo y Supabase envía un enlace. El enlace vuelve a `/acceso`, la página lee el token del fragmento de la URL (sin guardarlo) y pide la nueva contraseña; al guardarla se entra directamente. La respuesta no revela si un correo está registrado.

No hace falta SQL nuevo ni variables de entorno nuevas.

## Lo que tiene que hacer el propietario en Supabase

1. **SMTP propio (obligatorio para la recuperación)** — Authentication → Emails → SMTP Settings. El correo integrado de Supabase solo entrega a los miembros del equipo del proyecto y con un límite muy bajo por hora, así que sin esto los jugadores no recibirán el enlace. Sirve cualquier proveedor (Resend, Brevo, Gmail SMTP…).
2. **Comprobar Redirect URLs** — Authentication → URL Configuration: deben estar permitidas `https://escuelafitoraya.onrender.com/acceso` y, para pruebas locales, `http://127.0.0.1:3000/acceso` (según `docs/cuentas.md` ya lo están).
3. **(Opcional) Plantilla en español** — Authentication → Emails → Templates → «Reset Password». Mantener `{{ .ConfirmationURL }}` como enlace.

El cambio de contraseña desde Mi perfil no depende de ninguno de estos pasos.

## Cómo probarlo

Antes: `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (incluye `tests/account-password-change.test.ts`).

Con `pnpm dev` y una cuenta de prueba:

- **Cambiar contraseña**
  - [ ] Mi perfil → contraseña actual incorrecta → «La contraseña actual no es correcta».
  - [ ] Nuevas que no coinciden → aviso sin enviar nada.
  - [ ] Cambio correcto → mensaje de confirmación; cerrar sesión y entrar con la nueva funciona y con la antigua no.
- **Recuperar contraseña** (requiere el SMTP del paso 1)
  - [ ] Acceso → «¿Has olvidado tu contraseña?» → correo → mensaje de enlace enviado.
  - [ ] Llega el correo; el enlace abre «Elige una nueva contraseña».
  - [ ] Guardar → entra en Mi perfil; después se puede iniciar sesión con la nueva.
  - [ ] Volver a usar el mismo enlace → «El enlace no es válido o ha caducado».
  - [ ] Un correo no registrado muestra el mismo mensaje que uno registrado.

## Archivos

- `src/lib/account-password.ts` — `changeAccountPassword`, `requestPasswordReset`, `resetAccountPassword`.
- `src/app/api/account/route.ts` — acciones `change-password`, `recover`, `reset`.
- `src/components/account-access.tsx` — modos de recuperación y nueva contraseña en el acceso.
- `src/components/account-profile.tsx` — bloque «Cambiar contraseña».
- `src/app/globals.css` — estilos del enlace y del bloque.
- `tests/account-password-change.test.ts` — pruebas nuevas.
- `docs/cuentas.md` — sección «Contraseñas».

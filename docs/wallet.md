# Tarjetas de Apple Wallet y Google Wallet

Cada jugador añade su tarjeta desde **Mi perfil**. El entrenador o el capitán avisan al equipo desde la jornada: «Publicar convocatoria y notificar» (próximo partido) y «Notificar resultado» (última jornada). Mientras falten las credenciales de una plataforma, sus botones no aparecen.

## 1. Supabase

Ejecuta `supabase/wallet.sql` en el editor SQL del proyecto.

## 2. URL pública

`PUBLIC_BASE_URL=https://…` con el dominio definitivo. Apple la guarda dentro de cada tarjeta: si cambia, hay que volver a añadir las tarjetas.

## 3. Apple Wallet (Apple Developer Program)

1. En developer.apple.com → Certificates, IDs & Profiles → Identifiers → **Pass Type IDs**, crea `pass.<dominio-invertido>.equipo`. Ese valor va en `APPLE_PASS_TYPE_ID`.
2. En ese Pass Type ID, crea el certificado subiendo un CSR generado desde «Acceso a Llaveros» y descarga `pass.cer`.
3. Abre `pass.cer` en Llaveros y exporta certificado + clave como `pass.p12`.
4. Convierte a PEM (OpenSSL 3 necesita `-legacy` con los .p12 de Llaveros):
   ```sh
   openssl pkcs12 -legacy -in pass.p12 -clcerts -nokeys -out pass-cert.pem
   openssl pkcs12 -legacy -in pass.p12 -nocerts -out pass-key.pem   # pide una contraseña para la clave
   ```
5. Descarga el intermedio **Apple WWDR G4** (apple.com/certificateauthority) y conviértelo:
   ```sh
   openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem
   ```
6. Variables (cada PEM en base64 en una línea):
   ```sh
   APPLE_TEAM_ID=<Team ID de la cuenta>
   APPLE_PASS_CERT=$(base64 -i pass-cert.pem | tr -d '\n')
   APPLE_PASS_KEY=$(base64 -i pass-key.pem | tr -d '\n')
   APPLE_PASS_KEY_PASSPHRASE=<la contraseña del paso 4>
   APPLE_WWDR_CERT=$(base64 -i wwdr.pem | tr -d '\n')
   ```
7. Borra los `.p12` y `.pem` locales cuando estén en el gestor de secretos del hosting.

## 4. Google Wallet

1. En pay.google.com/business/console, crea la cuenta de emisor y solicita acceso a la **Google Wallet API**. El ID de emisor va en `GOOGLE_WALLET_ISSUER_ID`.
2. En Google Cloud, activa la «Google Wallet API», crea una **cuenta de servicio** y descarga su clave JSON.
3. En la consola de Wallet → Usuarios, invita al correo de la cuenta de servicio con rol de desarrollador.
4. `GOOGLE_WALLET_SA_JSON=$(base64 -i clave.json | tr -d '\n')` y borra el archivo local.
5. Mientras Google no apruebe la cuenta para producción, solo los usuarios de prueba añadidos en la consola pueden guardar la tarjeta.

## 5. Límites

- Apple solo muestra un aviso si cambia el texto de «Convocatoria» o de «Último resultado». Si vuelves a avisar sin cambios, la tarjeta no muestra nada nuevo.
- Google permite como mucho 3 avisos por tarjeta cada 24 h. Los que superen el límite aparecen como «sin aviso por el límite de Google» y la tarjeta se actualiza igualmente.
- En Render Free el servidor se duerme. La primera actualización después de un aviso puede tardar unos segundos (Apple reintenta sola).

## 6. Prueba final

1. Añade la tarjeta en un iPhone y en un Android desde Mi perfil.
2. Como entrenador, en el próximo partido: «Publicar convocatoria y notificar». Comprueba el aviso y el texto «Convocado J… · Pareja …».
3. En la última jornada jugada: «Notificar resultado». Comprueba el aviso con el marcador.
4. Elimina la tarjeta del iPhone y vuelve a avisar: el resumen no debe contar ese dispositivo y su registro desaparece de `wallet_devices`.

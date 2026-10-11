# Tarjetas de Apple Wallet y Google Wallet — Diseño

Fecha: 11/10/2026 · Estado: pendiente de revisión

## Objetivo

Cada jugador con cuenta puede añadir a Apple Wallet o Google Wallet una tarjeta personal de su equipo (A o B). La tarjeta muestra su próximo partido, si está convocado y con quién, el último resultado del equipo y sus puntos SNP. Cuando el entrenador o un capitán pulsa «Notificar», la tarjeta se actualiza y el móvil muestra un aviso en la pantalla de bloqueo.

Los avisos son **actualizaciones de la tarjeta**, no un chat: Apple avisa cuando cambia un campo con `changeMessage`; Google, cuando se añade un mensaje con `TEXT_AND_NOTIFY` (máximo 3 por tarjeta cada 24 h).

**Fuera de alcance:** mensajes libres del entrenador, carnet con foto, avisos automáticos (al guardar alineación, al registrar resultado o desde el sync SNP), cola de reintentos, relevancia por ubicación o fecha, y SaaS de terceros.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Plataformas | Apple Wallet y Google Wallet desde el principio. El owner crea las cuentas (Apple Developer Program y emisor de Google Pay & Wallet Console). |
| Implementación | Propia: `passkit-generator` para el `.pkpass`, web service de Apple en rutas de Next.js, APNs por HTTP/2 con `node:http2`, API REST de Google Wallet con `google-auth-library`. Datos en Supabase. |
| Tipo de tarjeta | Personal por jugador y equipo. Si un jugador está inscrito en A y B, tiene una tarjeta por equipo. |
| Contenido avisable | Convocatoria / próximo partido y resultado de la jornada. |
| Disparador | Botón manual del entrenador o de un capitán de ese equipo. |
| Generación | Siempre al vuelo con el estado actual. No se guardan `.pkpass` ni contenido de la tarjeta. |
| Convocatoria | Nueva tabla `published_lineups` que liga una alineación guardada (copia congelada de las parejas) a una jornada. |

## Contenido de la tarjeta

Apple: tipo `generic`. Google: `GenericClass` / `GenericObject`.

| Zona | Campo | Ejemplo | Avisa |
|---|---|---|---|
| Cabecera | Equipo | «Equipo A» | No |
| Principal | Jugador | «Carlos Martín · Revés» | No |
| Secundario | Próximo partido | «J5 · C.D. VibraPadel · Sáb 18/10 10:00 · Local» | No |
| Secundario | Convocatoria | «Convocado · Pareja 2 con Juan Pérez» / «No convocado» / «Pendiente» | **Sí** (`changeMessage: "%@"`) |
| Auxiliar | Último resultado | «J4 · Fito Raya A 3–2 Rival X» | **Sí** (`changeMessage: "%@"`) |
| Auxiliar | Puntos SNP | «1.245» | No |
| Reverso / detalles | Enlaces | Web del equipo y acta de la última jornada | No |
| Código | QR | URL de `/mi-perfil` | — |

Diseño visual: fondo oscuro con texto amarillo (identidad del club), logo de `public/`. Sin campos vacíos: si no hay próximo partido, «Sin partidos programados».

### Textos de aviso

- Convocado: `Convocado J5: sáb 18/10 10:00 · Pareja 2 con Juan`
- No convocado: `No convocado en J5`
- Resultado: `J4: Fito Raya A 3–2 Rival X`

En Google el mismo texto va en el mensaje (`header` = «Convocatoria J5» o «Resultado J4», `body` = el texto).

## Flujo del jugador

1. Inicia sesión y va a `/mi-perfil`.
2. Ve «Añadir a Apple Wallet» y/o «Guardar en Google Wallet» (según el dispositivo; ambos en escritorio). Un botón no aparece si faltan las credenciales de su plataforma.
3. Apple: `GET /api/wallet/apple?team=a` descarga el `.pkpass`. Google: `GET /api/wallet/google?team=a` redirige a `https://pay.google.com/gp/v/save/<jwt>`.
4. La primera descarga crea la fila en `wallet_passes` (o reutiliza la existente para ese jugador y equipo).

## Arquitectura

Patrón del repo: lógica pura en `src/domain`, servicios en `src/lib`, rutas en `src/app/api`.

### Dominio

- `src/domain/wallet-card.ts`
  - `buildWalletCard(input): WalletCardData`. La entrada incluye jugador, equipo, próximo partido, convocatoria publicada, último resultado y puntos SNP. Sin dependencias de Apple ni Google.
  - `lineupNotice(card)` y `resultNotice(card)`: textos de aviso.

### Servicios

- `src/lib/wallet-store.ts`: acceso a Supabase (`/rest/v1`, mismo estilo `fetch` que `saved-lineups.ts`) para `wallet_passes`, `wallet_devices` y `published_lineups`.
- `src/lib/wallet-card-service.ts`: reúne los datos reales (SNP, `match-results`, `published_lineups`, posiciones) y llama a `buildWalletCard`.
- `src/lib/wallet-apple.ts`: `WalletCardData` → `.pkpass` firmado (`passkit-generator`). Incluye `webServiceURL = ${PUBLIC_BASE_URL}/api/wallet/apple` y el `authenticationToken` de la tarjeta.
- `src/lib/wallet-apns.ts`: push vacío a `api.push.apple.com` por HTTP/2 con el certificado del Pass Type ID (`apns-topic = APPLE_PASS_TYPE_ID`).
- `src/lib/wallet-google.ts`: crea o actualiza la clase del equipo y el objeto del jugador, firma el JWT de «Guardar» y llama a `addMessage`.
- `src/lib/wallet-notify.ts`: orquesta un aviso (ver «Flujo de un aviso»).

### Rutas API

| Ruta | Quién | Qué |
|---|---|---|
| `GET /api/wallet/apple?team=` | Jugador con sesión | Descarga `.pkpass` (`application/vnd.apple.pkpass`). |
| `GET /api/wallet/google?team=` | Jugador con sesión | Redirige al enlace de guardar. |
| `POST /api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serial]` | Wallet (token) | Registra dispositivo y `pushToken`. 201 nuevo, 200 existente. |
| `DELETE` misma ruta | Wallet (token) | Da de baja el dispositivo para esa tarjeta. |
| `GET /api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]?passesUpdatedSince=` | Wallet | Seriales actualizados desde la marca. 204 si no hay. |
| `GET /api/wallet/apple/v1/passes/[passTypeId]/[serial]` | Wallet (token) | Última versión del `.pkpass`, con `Last-Modified`. |
| `POST /api/wallet/apple/v1/log` | Wallet | Registra los errores en consola del servidor. |
| `POST /api/wallet/notify` | Entrenador o capitán del equipo | `{ teamId, kind: "lineup" \| "result", fixtureId, lineupId? }`. |

Las rutas de Apple se autentican con la cabecera `Authorization: ApplePass <token>`, comparada en tiempo constante con `wallet_passes.auth_token`.

### Supabase (`supabase/wallet.sql`)

```sql
wallet_passes (
  serial uuid primary key,
  player_id text not null,
  team_id text not null check (team_id in ('a','b')),
  auth_token text not null,           -- 32 bytes aleatorios en base64url
  google_object_id text,
  updated_at timestamptz not null default now(),
  unique (player_id, team_id)
)
wallet_devices (
  device_id text not null,
  serial uuid not null references wallet_passes on delete cascade,
  push_token text not null,
  primary key (device_id, serial)
)
published_lineups (
  team_id text not null check (team_id in ('a','b')),
  fixture_id text not null,
  lineup_id uuid,
  pairs jsonb not null,                -- copia congelada
  published_at timestamptz not null default now(),
  primary key (team_id, fixture_id)
)
```

Todas con RLS activado, `revoke all` a `anon` y `authenticated`, y permisos solo para `service_role`, igual que las tablas actuales.

### Variables de entorno (solo servidor)

| Variable | Uso |
|---|---|
| `APPLE_PASS_TYPE_ID` | p. ej. `pass.com.fitoraya.equipo` |
| `APPLE_TEAM_ID` | Team ID de Apple Developer |
| `APPLE_PASS_CERT`, `APPLE_PASS_KEY`, `APPLE_PASS_KEY_PASSPHRASE` | Certificado y clave del Pass Type ID en PEM, en base64 |
| `APPLE_WWDR_CERT` | Certificado intermedio WWDR G4 en PEM, en base64 |
| `GOOGLE_WALLET_ISSUER_ID` | ID de emisor |
| `GOOGLE_WALLET_SA_JSON` | JSON de la service account, en base64 |
| `PUBLIC_BASE_URL` | URL HTTPS pública fija (Apple la guarda en la tarjeta) |

Se añaden a `.env.example` y a `render.yaml` (`sync: false`).

### UI

- `/mi-perfil`: bloque «Tarjeta del equipo» con los botones oficiales de Apple y Google (uno por equipo inscrito).
- Pantalla de la jornada, visible solo para el entrenador y los capitanes de ese equipo:
  - «Publicar convocatoria y notificar»: elige una alineación guardada y confirma.
  - «Notificar resultado»: activo cuando la jornada tiene resultado.
  - Tras el envío muestra el resumen, por ejemplo «Notificados 14 de 16 · 2 sin tarjeta · Google: 1 sin aviso por límite».

## Flujo de un aviso

1. `POST /api/wallet/notify` comprueba sesión y rol (`coach-auth`, `team-captains`). Si no tiene permiso, responde 403.
2. Si `kind = "lineup"`: guarda en `published_lineups` la copia de las parejas de `lineupId` (upsert por `team_id` + `fixture_id`).
3. Carga las `wallet_passes` del equipo y, para cada una, construye el `WalletCardData` actual y su texto de aviso.
4. **Google:** PATCH del objeto con los campos nuevos y luego `addMessage` con `messageType: TEXT_AND_NOTIFY`.
5. **Apple:** `updated_at = now()` en la tarjeta y push vacío a cada `push_token` de sus dispositivos. El iPhone consulta el web service, descarga el `.pkpass` regenerado y Wallet muestra el `changeMessage` del campo que cambió.
6. Responde `{ total, withoutPass, apple: { ok, failed }, google: { ok, failed, rateLimited } }`.

`kind = "result"` sigue los mismos pasos, salvo el 2. El resultado sale de `match-results` y del acta SNP, con la misma regla que el mensaje de WhatsApp.

## Errores

- APNs `410` / `BadDeviceToken`: se borra ese `wallet_devices`.
- Otros fallos de APNs o Google: cuentan como `failed` y no cortan el resto (`Promise.allSettled`). Sin reintentos automáticos; el entrenador puede volver a pulsar.
- Google con límite de mensajes o `429`: el objeto se actualiza igualmente; el mensaje cuenta como `rateLimited`.
- Faltan credenciales de una plataforma: su botón no aparece y `notify` la omite, indicándolo en el resumen.
- Jugador sin tarjeta: cuenta como `withoutPass`, no es error.
- Supabase no configurado: las rutas responden 503 con el mismo mensaje que el resto de la app.

## Seguridad

- `serial` UUID aleatorio (no el `player_id`); `auth_token` de 32 bytes aleatorios, comparado con `timingSafeEqual`.
- Claves y certificados solo en el servidor (nunca `NEXT_PUBLIC_`); `scripts/check-private-data.mjs` debe seguir pasando.
- `.pkpass` y JWT solo para el jugador con sesión y solo para un equipo en el que esté inscrito.
- `notify` solo para el entrenador y los capitanes de ese equipo.

## Pruebas

`tests/*.test.ts` con `tsx --test`:

- `wallet-card`: contenido y avisos en cada caso (convocado, no convocado, sin convocatoria publicada, sin próximo partido, con resultado, sin resultado, formato de los puntos SNP).
- Web service de Apple: token correcto e incorrecto, registro 201/200, baja, `passesUpdatedSince` con y sin cambios (200/204).
- `wallet-notify` con APNs y Google simulados: resumen, `withoutPass`, limpieza tras `410`, `rateLimited`.
- `wallet-google`: estructura del JWT (`iss`, `aud: google`, `typ: savetowallet`, `origins`) y del objeto.
- Permisos de `notify`: 403 para un jugador que no es capitán.

Prueba manual final con certificados reales en un iPhone y un Android: añadir la tarjeta, publicar convocatoria, ver el aviso y notificar el resultado.

## Requisitos externos (owner)

1. Apple Developer Program: crear el Pass Type ID, generar su certificado y exportar certificado y clave en PEM. Descargar WWDR G4.
2. Google Pay & Wallet Console: cuenta de emisor aprobada, API de Google Wallet activada en Google Cloud y service account con rol de emisor.
3. Ejecutar `supabase/wallet.sql` en Supabase.
4. Configurar las variables de entorno en Vercel/Render.

Hasta entonces, el código se desarrolla y prueba con datos simulados, y los botones permanecen ocultos.

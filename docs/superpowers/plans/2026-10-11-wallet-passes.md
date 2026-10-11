# Tarjetas de Apple Wallet y Google Wallet — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada jugador puede añadir a Apple Wallet o Google Wallet una tarjeta personal de su equipo, y el entrenador o un capitán la actualiza con un botón («Publicar convocatoria y notificar» / «Notificar resultado») para que el móvil muestre un aviso.

**Architecture:** El contenido de la tarjeta se calcula en una función pura (`src/domain/wallet-card.ts`) a partir de un `TeamCardContext`. Los adaptadores lo convierten en `.pkpass` firmado (`passkit-generator`) o en un `GenericObject` de Google. Los datos (tarjetas, dispositivos, convocatorias publicadas) viven en Supabase detrás de la interfaz `WalletStore`, con una implementación en memoria para los tests. El aviso lo orquesta `notifyTeam`, con los canales de Apple (APNs por `node:http2`) y Google (REST con `fetch` y JWT firmado con `node:crypto`) inyectados.

**Tech Stack:** Next.js 16.3 (App Router, route handlers con `params: Promise<…>`), TypeScript, Supabase REST (`/rest/v1`), `passkit-generator@3`, `node:http2`, `node:crypto`, tests con `tsx --test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-10-11-wallet-passes-design.md`

## Global Constraints

- Node 24.x, pnpm 11.19.0; instalar con `pnpm add`, nunca `npm install`.
- Única dependencia nueva: `passkit-generator@^3.6.1`. Nada de `google-auth-library`, `jsonwebtoken` ni librerías de APNs.
- Antes de escribir rutas, leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (AGENTS.md: «This is NOT the Next.js you know»). Los parámetros dinámicos se leen con `{ params }: { params: Promise<{…}> }`.
- Todas las rutas nuevas declaran `export const runtime = "nodejs";`.
- Las rutas de usuario responden con `accountReply` / `accountFailure` y lanzan `AccountError(mensaje, status)` (`src/lib/account-auth.ts`). Los POST de usuario leen el cuerpo con `accountBody(request)` (comprueba origen y tamaño).
- Claves y certificados solo en el servidor; nunca `NEXT_PUBLIC_`. Los tests generan sus claves en tiempo de ejecución: **ningún archivo del repo puede contener el texto `-----BEGIN … PRIVATE KEY-----`** (lo bloquea `scripts/check-repository.mjs`).
- Supabase: tablas con RLS, `revoke all … from anon, authenticated`, permisos solo para `service_role`.
- Textos visibles en español. Comentarios en inglés, cortos, como en el resto del repo.
- Colores de la tarjeta: fondo `#0a1825` (`rgb(10, 24, 37)`), valores `#f2c500` (`rgb(242, 197, 0)`), etiquetas blancas.
- Textos de los campos (y de los avisos):
  - `Convocado J5 · Pareja 2 con Juan Pérez` · `Convocado J5 · Pareja 2` · `No convocado en J5` · `Convocatoria J5 pendiente` · `Sin convocatoria`
  - `J4 · Fito Raya A 7–5 C.D. VibraPadel` · `Sin resultados todavía`
  - `J5 · C.D. VibraPadel · Sáb 18/10 10:00 · Local` · `Sin partidos programados`
- Avisos de Google: `header` = `Convocatoria J5` / `Resultado J4`, `body` = valor del campo, `messageType: "TEXT_AND_NOTIFY"`.
- Las parejas publicadas se congelan ordenadas con `sortPairs` (`src/domain/rules.ts`); su posición en el array es el número de pareja.
- La convocatoria solo se publica para el próximo partido (`fixtures.find(f => f.status === "pending")`); el resultado solo se notifica para `lastPlayedFixture(fixtures, now)`.
- Comprobación de cada tarea: `pnpm test`, `pnpm typecheck` y `pnpm lint` deben pasar antes del commit.
- Commits en la rama `feature/wallet-passes`, terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Jugador inscrito en A y B:** debe tener dos tarjetas independientes; notificar al A no toca las tarjetas ni los dispositivos del B. → test en Task 10.
2. **Convocatoria publicada para una jornada que ya no es la próxima:** la tarjeta debe mostrar `Convocatoria J6 pendiente`, no la convocatoria vieja. → test en Task 2.
3. **Jugador que sale de la plantilla con la tarjeta ya emitida:** el aviso lo ignora (sin error ni recuento) y el web service responde 404 al pedir su tarjeta. → tests en Tasks 10 y 9.
4. **Fecha sin hora (`2026-10-18`) o vacía:** el próximo partido muestra `Sáb 18/10` o `Fecha por confirmar`, nunca `Invalid Date` ni una hora inventada. → test en Task 2.
5. **`passesUpdatedSince` ausente, no numérico o del futuro:** sin marca o con marca no numérica se devuelven todas las tarjetas del dispositivo; con una marca futura, 204. Nunca un 500. → test en Task 8.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/wallet.sql` | Tablas `wallet_passes`, `wallet_devices`, `published_lineups` |
| `src/lib/wallet-config.ts` | Lee y valida las variables de entorno de Apple, Google y la URL pública |
| `src/domain/wallet-card.ts` | Tipos `TeamCardContext` y `WalletCardData`, textos de campos y avisos (puro) |
| `src/domain/wallet-ui.ts` | Plataformas según el user agent y texto del resumen de envío (puro) |
| `src/domain/team-result-message.ts` | (mod.) Extrae `teamScore(pairs)` |
| `src/domain/rules.ts` | (mod.) `pairPoints` / `sortPairs` aceptan `Pick<Player, "id" \| "points">[]` |
| `src/lib/team-result-service.ts` | (mod.) Extrae `resultPairs` y añade `teamResultScore` |
| `src/lib/wallet-store.ts` | Interfaz `WalletStore` + implementaciones Supabase y en memoria |
| `src/lib/wallet-apple.ts` | `pass.json` (puro) y firma del `.pkpass` |
| `src/lib/wallet-apns.ts` | Push a APNs y clasificación de respuestas |
| `src/lib/wallet-google.ts` | Objeto de Google, JWT de guardar y cliente REST |
| `src/lib/wallet-apple-service.ts` | Lógica del web service de Apple (registro, baja, actualizados) |
| `src/lib/wallet-issue.ts` | Contexto real del equipo, emisión de tarjetas y control de acceso del jugador |
| `src/lib/wallet-notify.ts` | Orquestación de un aviso con canales inyectados |
| `src/lib/wallet-notify-service.ts` | Publicar convocatoria + aviso con los canales reales; opciones para la UI |
| `src/app/api/wallet/**/route.ts` | Rutas (finas) |
| `src/components/wallet-buttons.tsx` | Botones en `/mi-perfil` |
| `src/components/wallet-notify.tsx` | Panel de aviso en la jornada |
| `docs/wallet.md` | Puesta en marcha para el owner |

---

### Task 1: Configuración, dependencia y SQL

**Files:**
- Create: `src/lib/wallet-config.ts`
- Create: `supabase/wallet.sql`
- Modify: `.env.example`, `render.yaml`, `scripts/check-repository.mjs:9`, `package.json` (vía pnpm)
- Test: `tests/wallet-config.test.ts`

**Interfaces:**
- Produces:
  - `type AppleConfig = { passTypeId: string; teamId: string; cert: string; key: string; passphrase?: string; wwdr: string }` (PEM ya decodificado)
  - `type GoogleConfig = { issuerId: string; clientEmail: string; privateKey: string }`
  - `publicBaseUrl(env?): string | null` (origen https, sin barra final)
  - `appleConfig(env?): AppleConfig | null`, `googleConfig(env?): GoogleConfig | null`
  - `walletAvailability(env?): { apple: boolean; google: boolean }`

- [ ] **Step 1: Instalar la dependencia**

Run: `pnpm add passkit-generator@^3.6.1`
Expected: `package.json` y `pnpm-lock.yaml` actualizados, sin avisos de builds bloqueados.

- [ ] **Step 2: Escribir el test que falla**

`tests/wallet-config.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { appleConfig, googleConfig, publicBaseUrl, walletAvailability } from "../src/lib/wallet-config";

const b64 = (text: string) => Buffer.from(text).toString("base64");
const apple = { PUBLIC_BASE_URL: "https://fito.example.com/", APPLE_PASS_TYPE_ID: "pass.com.fitoraya.equipo", APPLE_TEAM_ID: "ABCDE12345", APPLE_PASS_CERT: b64("CERT"), APPLE_PASS_KEY: b64("KEY"), APPLE_WWDR_CERT: b64("WWDR") };
const google = { PUBLIC_BASE_URL: "https://fito.example.com", GOOGLE_WALLET_ISSUER_ID: "3388000000012345678", GOOGLE_WALLET_SA_JSON: b64(JSON.stringify({ client_email: "wallet@fito.iam.gserviceaccount.com", private_key: "PK" })) };

test("la URL pública solo vale con https y se queda en el origen", () => {
  assert.equal(publicBaseUrl({ PUBLIC_BASE_URL: "https://fito.example.com/ruta/" }), "https://fito.example.com");
  assert.equal(publicBaseUrl({ PUBLIC_BASE_URL: "http://fito.example.com" }), null);
  assert.equal(publicBaseUrl({ PUBLIC_BASE_URL: "no es url" }), null);
  assert.equal(publicBaseUrl({}), null);
});
test("Apple decodifica los PEM en base64 y exige todas las variables", () => {
  assert.deepEqual(appleConfig(apple), { passTypeId: "pass.com.fitoraya.equipo", teamId: "ABCDE12345", cert: "CERT", key: "KEY", wwdr: "WWDR" });
  assert.equal(appleConfig({ ...apple, APPLE_PASS_KEY_PASSPHRASE: "secreto" })?.passphrase, "secreto");
  assert.equal(appleConfig({ ...apple, APPLE_WWDR_CERT: undefined }), null);
  assert.equal(appleConfig({ ...apple, PUBLIC_BASE_URL: undefined }), null);
});
test("Google lee la cuenta de servicio y rechaza JSON roto", () => {
  assert.deepEqual(googleConfig(google), { issuerId: "3388000000012345678", clientEmail: "wallet@fito.iam.gserviceaccount.com", privateKey: "PK" });
  assert.equal(googleConfig({ ...google, GOOGLE_WALLET_SA_JSON: b64("{roto") }), null);
  assert.equal(googleConfig({ ...google, GOOGLE_WALLET_SA_JSON: b64("{}") }), null);
});
test("disponibilidad por plataforma", () => {
  assert.deepEqual(walletAvailability({ ...apple, ...google }), { apple: true, google: true });
  assert.deepEqual(walletAvailability(google), { apple: false, google: true });
  assert.deepEqual(walletAvailability({}), { apple: false, google: false });
});
```

- [ ] **Step 3: Comprobar que falla**

Run: `pnpm exec tsx --test tests/wallet-config.test.ts`
Expected: FAIL, `Cannot find module '../src/lib/wallet-config'`.

- [ ] **Step 4: Implementar**

`src/lib/wallet-config.ts`:

```ts
// Wallet credentials are server-only and stored as base64 so PEM newlines survive hosting UIs.
type Env = Record<string, string | undefined>;
export type AppleConfig = { passTypeId: string; teamId: string; cert: string; key: string; passphrase?: string; wwdr: string };
export type GoogleConfig = { issuerId: string; clientEmail: string; privateKey: string };
const decode = (value: string) => Buffer.from(value, "base64").toString("utf8");
// Apple stores this URL inside every pass: it must be public, fixed and https.
export function publicBaseUrl(env: Env = process.env): string | null {
  const value = env.PUBLIC_BASE_URL?.trim(); if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.origin : null; } catch { return null; }
}
export function appleConfig(env: Env = process.env): AppleConfig | null {
  const { APPLE_PASS_TYPE_ID: passTypeId, APPLE_TEAM_ID: teamId, APPLE_PASS_CERT: cert, APPLE_PASS_KEY: key, APPLE_WWDR_CERT: wwdr, APPLE_PASS_KEY_PASSPHRASE: passphrase } = env;
  if (!passTypeId || !teamId || !cert || !key || !wwdr || !publicBaseUrl(env)) return null;
  return { passTypeId, teamId, cert: decode(cert), key: decode(key), wwdr: decode(wwdr), ...(passphrase ? { passphrase } : {}) };
}
export function googleConfig(env: Env = process.env): GoogleConfig | null {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID; const raw = env.GOOGLE_WALLET_SA_JSON;
  if (!issuerId || !raw || !publicBaseUrl(env)) return null;
  try {
    const json = JSON.parse(decode(raw));
    return typeof json.client_email === "string" && typeof json.private_key === "string" ? { issuerId, clientEmail: json.client_email, privateKey: json.private_key } : null;
  } catch { return null; }
}
export const walletAvailability = (env: Env = process.env) => ({ apple: appleConfig(env) !== null, google: googleConfig(env) !== null });
```

- [ ] **Step 5: Comprobar que pasa**

Run: `pnpm exec tsx --test tests/wallet-config.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: SQL**

`supabase/wallet.sql`:

```sql
-- Wallet passes: one per player and club team. Only the server can read or write them.
create table if not exists public.wallet_passes (
  serial uuid primary key,
  player_id text not null check (player_id ~ '^[0-9]{1,10}$'),
  team_id text not null check (team_id in ('a', 'b')),
  auth_token text not null check (length(auth_token) >= 32),
  google_object_id text,
  updated_at timestamptz not null default now(),
  unique (player_id, team_id)
);
-- Apple devices that registered a pass for updates.
create table if not exists public.wallet_devices (
  device_id text not null,
  serial uuid not null references public.wallet_passes(serial) on delete cascade,
  push_token text not null,
  primary key (device_id, serial)
);
-- The lineup the coach published for a fixture: a frozen copy of the pairs in pair order.
create table if not exists public.published_lineups (
  team_id text not null check (team_id in ('a', 'b')),
  fixture_id text not null check (fixture_id ~ '^[0-9]{1,10}$'),
  lineup_id uuid,
  pairs jsonb not null,
  published_at timestamptz not null default now(),
  primary key (team_id, fixture_id)
);
alter table public.wallet_passes enable row level security;
alter table public.wallet_devices enable row level security;
alter table public.published_lineups enable row level security;
revoke all on public.wallet_passes, public.wallet_devices, public.published_lineups from anon, authenticated;
grant select, insert, update, delete on public.wallet_passes, public.wallet_devices, public.published_lineups to service_role;
```

- [ ] **Step 7: Variables de entorno**

Añadir al final de `.env.example`:

```sh
# Wallet (server-only). PEM files and the service account JSON go base64-encoded on one line.
# Fixed public https URL: Apple stores it inside every pass.
PUBLIC_BASE_URL=
APPLE_PASS_TYPE_ID=
APPLE_TEAM_ID=
APPLE_PASS_CERT=
APPLE_PASS_KEY=
APPLE_PASS_KEY_PASSPHRASE=
APPLE_WWDR_CERT=
GOOGLE_WALLET_ISSUER_ID=
GOOGLE_WALLET_SA_JSON=
```

Añadir a `render.yaml`, dentro de `envVars`, después de `SUPABASE_SECRET_KEY`:

```yaml
      - key: PUBLIC_BASE_URL
        sync: false
      - key: APPLE_PASS_TYPE_ID
        sync: false
      - key: APPLE_TEAM_ID
        sync: false
      - key: APPLE_PASS_CERT
        sync: false
      - key: APPLE_PASS_KEY
        sync: false
      - key: APPLE_PASS_KEY_PASSPHRASE
        sync: false
      - key: APPLE_WWDR_CERT
        sync: false
      - key: GOOGLE_WALLET_ISSUER_ID
        sync: false
      - key: GOOGLE_WALLET_SA_JSON
        sync: false
```

En `scripts/check-repository.mjs:9`, ampliar la lista de secretos:

```js
const secrets = [process.env.SNP_EMAIL, process.env.SNP_PASSWORD, process.env.POSITIONS_ADMIN_PASSWORD, process.env.SUPABASE_SECRET_KEY, process.env.APPLE_PASS_KEY, process.env.APPLE_PASS_KEY_PASSPHRASE, process.env.GOOGLE_WALLET_SA_JSON].filter(Boolean);
```

- [ ] **Step 8: Verificar y hacer commit**

Run: `pnpm typecheck && pnpm lint && pnpm test && node scripts/check-repository.mjs`
Expected: todo en verde, `findings: []`.

```bash
git add package.json pnpm-lock.yaml src/lib/wallet-config.ts supabase/wallet.sql .env.example render.yaml scripts/check-repository.mjs tests/wallet-config.test.ts
git commit -m "feat: configuración y tablas de las tarjetas Wallet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Contenido de la tarjeta (dominio puro)

**Files:**
- Create: `src/domain/wallet-card.ts`
- Modify: `src/domain/rules.ts:18,28` (ampliar tipos de `pairPoints` y `sortPairs`)
- Test: `tests/wallet-card.test.ts`

**Interfaces:**
- Consumes: `displayName` (`src/domain/team-result-message.ts`), `POSITION_LABELS` (`src/domain/rules.ts`), `Pair`, `Position`, `TeamId` (`src/domain/types.ts`)
- Produces:
  - `type CardPlayer = { id: string; sourceId: string; name: string; position: Position | null; points: number | null }`. `id` es el id del equipo (`a-123`) que usan las parejas; `sourceId` es el id SNP (`player_accounts.player_id`).
  - `type CardFixture = { id: string; round: number; opponent: string; date: string; home: boolean }`
  - `type CardResult = { fixtureId: string; round: number; opponent: string; ours: number; theirs: number }`
  - `type TeamCardContext = { teamId: TeamId; players: CardPlayer[]; next: CardFixture | null; published: { fixtureId: string; pairs: Pair[] } | null; last: CardResult | null }`
  - `type WalletCardData = { teamId: TeamId; playerSourceId: string; teamLabel: string; playerLine: string; nextMatch: string; lineup: string; lastResult: string; snpPoints: string; teamPath: string; actaPath: string | null }`
  - `type NotifyKind = "lineup" | "result"`
  - `shortDate(date: string): string | null`
  - `buildWalletCard(ctx: TeamCardContext, sourceId: string): WalletCardData | null`
  - `walletNotice(ctx: TeamCardContext, card: WalletCardData, kind: NotifyKind): { header: string; body: string } | null`
  - `pairPoints` / `sortPairs` aceptan `Pick<Player, "id" | "points">[]`

- [ ] **Step 1: Escribir el test que falla**

`tests/wallet-card.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildWalletCard, shortDate, walletNotice, type TeamCardContext } from "../src/domain/wallet-card";

const players = [
  { id: "a-1", sourceId: "1", name: "CARLOS MARTIN", position: "LEFT" as const, points: 20312.5 },
  { id: "a-2", sourceId: "2", name: "juan perez", position: "RIGHT" as const, points: 900 },
  { id: "b-3", sourceId: "3", name: "Ana Ruiz", position: null, points: null },
];
const next = { id: "50", round: 5, opponent: "C.D. VibraPadel", date: "2026-10-18T08:00:00.000Z", home: true };
const ctx = (over: Partial<TeamCardContext> = {}): TeamCardContext => ({ teamId: "a", players, next, published: { fixtureId: "50", pairs: [{ id: "p1", players: ["a-2", "b-3"] }, { id: "p2", players: ["a-1", "a-2"] }] }, last: { fixtureId: "40", round: 4, opponent: "Rival X", ours: 7, theirs: 5 }, ...over });

test("tarjeta completa de un jugador convocado", () => {
  assert.deepEqual(buildWalletCard(ctx(), "1"), {
    teamId: "a", playerSourceId: "1", teamLabel: "Equipo A", playerLine: "Carlos Martin · Revés",
    nextMatch: "J5 · C.D. VibraPadel · Dom 18/10 10:00 · Local",
    lineup: "Convocado J5 · Pareja 2 con Juan Perez", lastResult: "J4 · Fito Raya A 7–5 Rival X",
    snpPoints: "20.313", teamPath: "/equipos/a/jornadas", actaPath: "/equipos/a/jornadas/40",
  });
});
test("convocatoria: sin compañero, no convocado, pendiente y sin partido", () => {
  const solo = ctx({ published: { fixtureId: "50", pairs: [{ id: "p1", players: ["a-1", null] }] } });
  assert.equal(buildWalletCard(solo, "1")!.lineup, "Convocado J5 · Pareja 1");
  assert.equal(buildWalletCard(ctx(), "3")!.lineup, "Convocado J5 · Pareja 1 con Juan Perez");
  assert.equal(buildWalletCard(ctx({ published: { fixtureId: "50", pairs: [{ id: "p1", players: ["a-2", null] }] } }), "1")!.lineup, "No convocado en J5");
  assert.equal(buildWalletCard(ctx({ published: null }), "1")!.lineup, "Convocatoria J5 pendiente");
  const none = buildWalletCard(ctx({ next: null, published: null }), "1")!;
  assert.equal(none.lineup, "Sin convocatoria");
  assert.equal(none.nextMatch, "Sin partidos programados");
});
test("una convocatoria de otra jornada no se muestra", () => {
  const stale = ctx({ next: { ...next, id: "60", round: 6 }, published: { fixtureId: "50", pairs: [{ id: "p1", players: ["a-1", "a-2"] }] } });
  assert.equal(buildWalletCard(stale, "1")!.lineup, "Convocatoria J6 pendiente");
});
test("fechas sin hora o vacías", () => {
  assert.equal(shortDate("2026-10-18"), "Dom 18/10");
  assert.equal(shortDate(""), null);
  assert.equal(shortDate("mañana"), null);
  assert.equal(buildWalletCard(ctx({ next: { ...next, date: "", home: false } }), "1")!.nextMatch, "J5 · C.D. VibraPadel · Fecha por confirmar · Visitante");
});
test("sin resultado, sin puntos, sin posición y jugador fuera de plantilla", () => {
  const card = buildWalletCard(ctx({ last: null }), "3")!;
  assert.equal(card.lastResult, "Sin resultados todavía");
  assert.equal(card.actaPath, null);
  assert.equal(card.snpPoints, "—");
  assert.equal(card.playerLine, "Ana Ruiz");
  assert.equal(buildWalletCard(ctx(), "999"), null);
});
test("avisos de convocatoria y resultado", () => {
  const card = buildWalletCard(ctx(), "1")!;
  assert.deepEqual(walletNotice(ctx(), card, "lineup"), { header: "Convocatoria J5", body: "Convocado J5 · Pareja 2 con Juan Perez" });
  assert.deepEqual(walletNotice(ctx(), card, "result"), { header: "Resultado J4", body: "J4 · Fito Raya A 7–5 Rival X" });
  assert.equal(walletNotice(ctx({ next: null }), card, "lineup"), null);
  assert.equal(walletNotice(ctx({ last: null }), card, "result"), null);
});
```

- [ ] **Step 2: Comprobar que falla**

Run: `pnpm exec tsx --test tests/wallet-card.test.ts`
Expected: FAIL, `Cannot find module '../src/domain/wallet-card'`.

- [ ] **Step 3: Ampliar los tipos de `rules.ts`**

En `src/domain/rules.ts`, cambiar solo las firmas (el cuerpo no cambia):

```ts
export function pairPoints(pair: Pair, players: Pick<Player, "id" | "points">[]): number | null {
```

```ts
export function sortPairs(pairs: Pair[], players: Pick<Player, "id" | "points">[]): Pair[] {
```

- [ ] **Step 4: Implementar**

`src/domain/wallet-card.ts`:

```ts
import type { Pair, Position, TeamId } from "./types";
import { POSITION_LABELS } from "./rules";
import { displayName } from "./team-result-message";
export type CardPlayer = { id: string; sourceId: string; name: string; position: Position | null; points: number | null };
export type CardFixture = { id: string; round: number; opponent: string; date: string; home: boolean };
export type CardResult = { fixtureId: string; round: number; opponent: string; ours: number; theirs: number };
export type TeamCardContext = { teamId: TeamId; players: CardPlayer[]; next: CardFixture | null; published: { fixtureId: string; pairs: Pair[] } | null; last: CardResult | null };
export type WalletCardData = { teamId: TeamId; playerSourceId: string; teamLabel: string; playerLine: string; nextMatch: string; lineup: string; lastResult: string; snpPoints: string; teamPath: string; actaPath: string | null };
export type NotifyKind = "lineup" | "result";
// "Sáb 18/10 10:00" in Madrid time; dates without time show only the day.
export function shortDate(date: string): string | null {
  const time = Date.parse(date); if (!date || Number.isNaN(time)) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Madrid" }).formatToParts(new Date(time)).map(p => [p.type, p.value]));
  const day = `${parts.weekday.charAt(0).toUpperCase()}${parts.weekday.slice(1).replace(".", "")} ${parts.day}/${parts.month}`;
  const hour = date.includes("T") ? new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(time)) : null;
  return hour ? `${day} ${hour}` : day;
}
function nextMatch(next: CardFixture | null) {
  return next ? [`J${next.round}`, next.opponent, shortDate(next.date) ?? "Fecha por confirmar", next.home ? "Local" : "Visitante"].join(" · ") : "Sin partidos programados";
}
// The published pairs are frozen in pair order: array position + 1 is the pair number.
function lineup(ctx: TeamCardContext, player: CardPlayer) {
  if (!ctx.next) return "Sin convocatoria";
  const round = `J${ctx.next.round}`;
  if (!ctx.published || ctx.published.fixtureId !== ctx.next.id) return `Convocatoria ${round} pendiente`;
  const index = ctx.published.pairs.findIndex(pair => pair.players.includes(player.id));
  if (index < 0) return `No convocado en ${round}`;
  const partnerId = ctx.published.pairs[index].players.find(id => id !== null && id !== player.id);
  const partner = partnerId ? ctx.players.find(p => p.id === partnerId) : undefined;
  return `Convocado ${round} · Pareja ${index + 1}${partner ? ` con ${displayName(partner.name)}` : ""}`;
}
export function buildWalletCard(ctx: TeamCardContext, sourceId: string): WalletCardData | null {
  const player = ctx.players.find(p => p.sourceId === sourceId); if (!player) return null;
  const team = ctx.teamId.toUpperCase();
  return {
    teamId: ctx.teamId, playerSourceId: sourceId, teamLabel: `Equipo ${team}`,
    playerLine: player.position ? `${displayName(player.name)} · ${POSITION_LABELS[player.position]}` : displayName(player.name),
    nextMatch: nextMatch(ctx.next), lineup: lineup(ctx, player),
    lastResult: ctx.last ? `J${ctx.last.round} · Fito Raya ${team} ${ctx.last.ours}–${ctx.last.theirs} ${ctx.last.opponent}` : "Sin resultados todavía",
    snpPoints: player.points === null ? "—" : Math.round(player.points).toLocaleString("es-ES"),
    teamPath: `/equipos/${ctx.teamId}/jornadas`, actaPath: ctx.last ? `/equipos/${ctx.teamId}/jornadas/${ctx.last.fixtureId}` : null,
  };
}
// Apple shows the new field value (changeMessage "%@"); Google gets the same text.
export function walletNotice(ctx: TeamCardContext, card: WalletCardData, kind: NotifyKind): { header: string; body: string } | null {
  if (kind === "lineup") return ctx.next ? { header: `Convocatoria J${ctx.next.round}`, body: card.lineup } : null;
  return ctx.last ? { header: `Resultado J${ctx.last.round}`, body: card.lastResult } : null;
}
```

- [ ] **Step 5: Comprobar que pasa**

Run: `pnpm exec tsx --test tests/wallet-card.test.ts`
Expected: PASS (6 tests). Si `snpPoints` sale `"20313"`, el entorno no tiene ICU completo: Node 24 lo incluye, así que revisa la versión de Node (`node -v`).

- [ ] **Step 6: Verificar y hacer commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`

```bash
git add src/domain/wallet-card.ts src/domain/rules.ts tests/wallet-card.test.ts
git commit -m "feat: contenido de la tarjeta Wallet y textos de aviso

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Marcador del equipo reutilizable

**Files:**
- Modify: `src/domain/team-result-message.ts` (extraer `teamScore`)
- Modify: `src/lib/team-result-service.ts` (extraer `resultPairs`, añadir `teamResultScore`)
- Test: `tests/team-result-message.test.ts` (añadir test)

**Interfaces:**
- Consumes: `TeamResultPair`, `MATCH_VALUES`
- Produces:
  - `teamScore(pairs: TeamResultPair[]): [number, number]` (nuestros, suyos)
  - `resultPairs(teamId: TeamId, fixture: Fixture, acta?: SnpMatch | null): Promise<TeamResultPair[] | null>`
  - `teamResultScore(teamId: TeamId, fixture: Fixture): Promise<[number, number] | null>`: parejas de la app/acta; si faltan, `fixture.score` girado según `home`; si tampoco hay, `null`.

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `tests/team-result-message.test.ts` (y añadir `teamScore` al `import` de la línea 3):

```ts
test("teamScore suma el valor de cada pareja ganada desde nuestro lado", () => {
  assert.deepEqual(teamScore([pair(1, win), pair(2, loss), pair(3, [[6, 4], [3, 6], [10, 8]]), pair(4, loss), pair(5, win)]), [7, 5]);
  assert.deepEqual(teamScore([pair(1, loss), pair(2, loss), pair(3, loss), pair(4, loss), pair(5, loss)]), [0, 12]);
});
```

- [ ] **Step 2: Comprobar que falla**

Run: `pnpm exec tsx --test tests/team-result-message.test.ts`
Expected: FAIL, `teamScore is not a function` (o error de import).

- [ ] **Step 3: Implementar `teamScore` y usarlo en `buildTeamResultMessage`**

En `src/domain/team-result-message.ts`, justo después de la línea `const won = …`:

```ts
export function teamScore(pairs: TeamResultPair[]): [number, number] {
  let ours = 0, theirs = 0;
  for (const pair of pairs) { const value = MATCH_VALUES[pair.index - 1]; if (won(pair.sets)) ours += value; else theirs += value; }
  return [ours, theirs];
}
```

y en `buildTeamResultMessage` sustituir las dos primeras líneas del cuerpo (`let ours = 0, theirs = 0;` y el `for`) por:

```ts
  const [ours, theirs] = teamScore(pairs);
```

- [ ] **Step 4: Extraer `resultPairs` y añadir `teamResultScore`**

En `src/lib/team-result-service.ts`, sustituir la función `teamResultMessage` por estas tres funciones (la firma y el comportamiento de `teamResultMessage` no cambian):

```ts
// The five pairs from our side for a fixture, or null while any pair lacks a result.
export async function resultPairs(teamId: TeamId, fixture: Fixture, acta?: SnpMatch | null): Promise<TeamResultPair[] | null> {
  const [rows, match, players] = await Promise.all([listResults([fixture.id]), acta !== undefined ? acta : getSnpMatch(fixture.id).then(r => r.data).catch(() => null), clubRepository.getPlayers(teamId).catch(() => [])]);
  const own = rows.filter(r => r.team_id === teamId);
  const index = match?.teamIds?.indexOf(sourceTeams[teamId]) ?? -1;
  const ownSide = (index >= 0 ? index : fixture.home ? 0 : 1) as 0 | 1;
  const submitterNames: Record<number, string> = {};
  for (const r of own) { const name = players.find(p => p.sourceId === r.player_id)?.name; if (name) submitterNames[r.pair_index] = name; }
  return teamResultPairs({ appResults: Object.fromEntries(own.map(r => [r.pair_index, r.sets])), acta: match, ownSide, submitterNames });
}
// Built on the server only: the client never supplies any data for the message.
export async function teamResultMessage(teamId: TeamId, fixture: Fixture, acta?: SnpMatch | null): Promise<TeamResultMessage | null> {
  const pairs = await resultPairs(teamId, fixture, acta);
  if (!pairs) return null;
  const text = buildTeamResultMessage({ round: fixture.round, teamId, opponent: fixture.opponent, home: fixture.home, date: fixture.date, pairs });
  return { fixtureId: fixture.id, teamId, round: fixture.round, text, url: whatsappShareUrl(text) };
}
// Same rule as the WhatsApp message; SNP's published score is the fallback.
export async function teamResultScore(teamId: TeamId, fixture: Fixture): Promise<[number, number] | null> {
  const pairs = await resultPairs(teamId, fixture);
  if (pairs) return teamScore(pairs);
  return fixture.score ? (fixture.home ? fixture.score : [fixture.score[1], fixture.score[0]]) : null;
}
```

Actualizar los imports de la cabecera del archivo:

```ts
import { buildTeamResultMessage, teamResultPairs, teamScore, whatsappShareUrl, type TeamResultPair } from "@/domain/team-result-message";
```

- [ ] **Step 5: Comprobar que pasa**

Run: `pnpm test`
Expected: PASS, incluidos todos los tests de `team-result-message.test.ts` que ya existían.

- [ ] **Step 6: Verificar y hacer commit**

Run: `pnpm typecheck && pnpm lint`

```bash
git add src/domain/team-result-message.ts src/lib/team-result-service.ts tests/team-result-message.test.ts
git commit -m "refactor: marcador del equipo reutilizable para Wallet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Almacén de Wallet

**Files:**
- Create: `src/lib/wallet-store.ts`
- Test: `tests/wallet-store.test.ts`

**Interfaces:**
- Consumes: `AccountError`, `accountConfig` (`src/lib/account-auth.ts`), `Pair`, `TeamId`
- Produces:
  - `type WalletPass = { serial: string; player_id: string; team_id: TeamId; auth_token: string; google_object_id: string | null; updated_at: string }`
  - `type WalletDevice = { device_id: string; serial: string; push_token: string }`
  - `type PublishedLineup = { team_id: TeamId; fixture_id: string; lineup_id: string | null; pairs: Pair[]; published_at: string }`
  - `interface WalletStore` con: `passBySerial(serial)`, `passFor(playerId, teamId)`, `createPass(pass)` (si ya existe para ese jugador y equipo, devuelve la existente), `setGoogleObject(serial, objectId)`, `teamPasses(teamId)`, `touchPasses(serials, at)`, `addDevice(device): Promise<"created" | "exists">`, `removeDevice(deviceId, serial)`, `removePushToken(token)`, `devicesFor(serials)`, `devicePasses(deviceId)`, `publishedLineup(teamId, fixtureId)`, `publishLineup(row)` (sustituye la de esa jornada)
  - `memoryWalletStore(): WalletStore & { passes: WalletPass[]; devices: WalletDevice[]; lineups: PublishedLineup[] }`
  - `supabaseWalletStore(config: { url: string; key: string }, fetchImpl?: typeof fetch): WalletStore`
  - `walletStore(): WalletStore`. Usa `accountConfig()`, que lanza `AccountError(…, 503)` si falta Supabase.

- [ ] **Step 1: Escribir el test que falla**

`tests/wallet-store.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { memoryWalletStore, supabaseWalletStore, type WalletPass } from "../src/lib/wallet-store";

const pass = (over: Partial<WalletPass> = {}): WalletPass => ({ serial: "11111111-1111-4111-8111-111111111111", player_id: "1", team_id: "a", auth_token: "t".repeat(43), google_object_id: null, updated_at: "2026-10-11T10:00:00.000Z", ...over });

test("memoria: una tarjeta por jugador y equipo", async () => {
  const store = memoryWalletStore();
  await store.createPass(pass());
  const again = await store.createPass(pass({ serial: "22222222-2222-4222-8222-222222222222" }));
  assert.equal(again.serial, "11111111-1111-4111-8111-111111111111");
  await store.createPass(pass({ serial: "33333333-3333-4333-8333-333333333333", team_id: "b" }));
  assert.equal((await store.teamPasses("a")).length, 1);
  assert.equal((await store.passFor("1", "b"))?.serial, "33333333-3333-4333-8333-333333333333");
});
test("memoria: dispositivos, baja por token y tarjetas de un dispositivo", async () => {
  const store = memoryWalletStore(); await store.createPass(pass());
  assert.equal(await store.addDevice({ device_id: "d1", serial: pass().serial, push_token: "aa" }), "created");
  assert.equal(await store.addDevice({ device_id: "d1", serial: pass().serial, push_token: "bb" }), "exists");
  assert.equal(store.devices[0].push_token, "bb");
  assert.deepEqual((await store.devicePasses("d1")).map(p => p.serial), [pass().serial]);
  await store.removePushToken("bb");
  assert.deepEqual(await store.devicesFor([pass().serial]), []);
});
test("memoria: publicar sustituye la convocatoria de la misma jornada", async () => {
  const store = memoryWalletStore();
  const row = { team_id: "a" as const, fixture_id: "50", lineup_id: null, pairs: [], published_at: "x" };
  await store.publishLineup(row); await store.publishLineup({ ...row, published_at: "y" });
  assert.equal(store.lineups.length, 1);
  assert.equal((await store.publishedLineup("a", "50"))?.published_at, "y");
  assert.equal(await store.publishedLineup("b", "50"), null);
});
test("supabase: filtros, upsert y tabla ausente", async () => {
  const calls: { url: string; method: string; prefer: string }[] = [];
  const fake = (async (input: URL | string, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? "GET", prefer: new Headers(init?.headers).get("Prefer") ?? "" });
    return Response.json([]);
  }) as typeof fetch;
  const store = supabaseWalletStore({ url: "https://db.example.com", key: "sb_secret_x" }, fake);
  await store.devicesFor(["s1", "s2"]);
  await store.publishLineup({ team_id: "a", fixture_id: "50", lineup_id: null, pairs: [], published_at: "x" });
  assert.match(calls[0].url, /wallet_devices\?select=device_id%2Cserial%2Cpush_token&serial=in.%28s1%2Cs2%29/);
  assert.equal(calls[1].method, "POST");
  assert.match(calls[1].url, /on_conflict=team_id%2Cfixture_id/);
  assert.match(calls[1].prefer, /merge-duplicates/);
  const missing = supabaseWalletStore({ url: "https://db.example.com", key: "k" }, (async () => Response.json({ code: "PGRST205" }, { status: 404 })) as typeof fetch);
  await assert.rejects(missing.passBySerial("s"), { message: /supabase\/wallet\.sql/, status: 503 });
  assert.deepEqual(await missing.devicesFor([]), []);
});
```

- [ ] **Step 2: Comprobar que falla**

Run: `pnpm exec tsx --test tests/wallet-store.test.ts`
Expected: FAIL, `Cannot find module`.

- [ ] **Step 3: Implementar**

`src/lib/wallet-store.ts`:

```ts
import { accountConfig, AccountError } from "./account-auth";
import type { Pair, TeamId } from "@/domain/types";
export type WalletPass = { serial: string; player_id: string; team_id: TeamId; auth_token: string; google_object_id: string | null; updated_at: string };
export type WalletDevice = { device_id: string; serial: string; push_token: string };
export type PublishedLineup = { team_id: TeamId; fixture_id: string; lineup_id: string | null; pairs: Pair[]; published_at: string };
export interface WalletStore {
  passBySerial(serial: string): Promise<WalletPass | null>;
  passFor(playerId: string, teamId: TeamId): Promise<WalletPass | null>;
  createPass(pass: WalletPass): Promise<WalletPass>;
  setGoogleObject(serial: string, objectId: string): Promise<void>;
  teamPasses(teamId: TeamId): Promise<WalletPass[]>;
  touchPasses(serials: string[], at: string): Promise<void>;
  addDevice(device: WalletDevice): Promise<"created" | "exists">;
  removeDevice(deviceId: string, serial: string): Promise<void>;
  removePushToken(pushToken: string): Promise<void>;
  devicesFor(serials: string[]): Promise<WalletDevice[]>;
  devicePasses(deviceId: string): Promise<WalletPass[]>;
  publishedLineup(teamId: TeamId, fixtureId: string): Promise<PublishedLineup | null>;
  publishLineup(row: PublishedLineup): Promise<void>;
}
function remove<T>(rows: T[], match: (row: T) => boolean) { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i])) rows.splice(i, 1); }
// Test double with the same contract as Supabase.
export function memoryWalletStore(): WalletStore & { passes: WalletPass[]; devices: WalletDevice[]; lineups: PublishedLineup[] } {
  const passes: WalletPass[] = []; const devices: WalletDevice[] = []; const lineups: PublishedLineup[] = [];
  return {
    passes, devices, lineups,
    async passBySerial(serial) { return passes.find(p => p.serial === serial) ?? null; },
    async passFor(playerId, teamId) { return passes.find(p => p.player_id === playerId && p.team_id === teamId) ?? null; },
    async createPass(pass) { const existing = passes.find(p => p.player_id === pass.player_id && p.team_id === pass.team_id); if (existing) return existing; passes.push(pass); return pass; },
    async setGoogleObject(serial, objectId) { const pass = passes.find(p => p.serial === serial); if (pass) pass.google_object_id = objectId; },
    async teamPasses(teamId) { return passes.filter(p => p.team_id === teamId); },
    async touchPasses(serials, at) { for (const pass of passes) if (serials.includes(pass.serial)) pass.updated_at = at; },
    async addDevice(device) {
      const existing = devices.find(d => d.device_id === device.device_id && d.serial === device.serial);
      if (existing) { existing.push_token = device.push_token; return "exists"; }
      devices.push(device); return "created";
    },
    async removeDevice(deviceId, serial) { remove(devices, d => d.device_id === deviceId && d.serial === serial); },
    async removePushToken(token) { remove(devices, d => d.push_token === token); },
    async devicesFor(serials) { return devices.filter(d => serials.includes(d.serial)); },
    async devicePasses(deviceId) { const serials = devices.filter(d => d.device_id === deviceId).map(d => d.serial); return passes.filter(p => serials.includes(p.serial)); },
    async publishedLineup(teamId, fixtureId) { return lineups.find(l => l.team_id === teamId && l.fixture_id === fixtureId) ?? null; },
    async publishLineup(row) { remove(lineups, l => l.team_id === row.team_id && l.fixture_id === row.fixture_id); lineups.push(row); },
  };
}
const PASS_FIELDS = "serial,player_id,team_id,auth_token,google_object_id,updated_at";
const inList = (values: string[]) => `in.(${values.join(",")})`;
export function supabaseWalletStore({ url, key }: { url: string; key: string }, fetchImpl: typeof fetch = fetch): WalletStore {
  async function rest<T>(table: string, method: string, params: Record<string, string>, body?: object, prefer = "return=minimal"): Promise<T> {
    const endpoint = new URL(`/rest/v1/${table}`, url);
    if (endpoint.protocol !== "https:") throw new Error("URL no válida");
    for (const [k, v] of Object.entries(params)) endpoint.searchParams.set(k, v);
    const response = await fetchImpl(endpoint, { method, cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", Prefer: prefer }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 404) { const error = await response.json().catch(() => ({})); if (error.code === "PGRST205" || error.code === "42P01") throw new AccountError("Faltan las tablas de Wallet. Ejecuta supabase/wallet.sql en Supabase.", 503); }
    if (!response.ok) throw new AccountError("No se pudo acceder a los datos de Wallet.", 503);
    return (method === "GET" ? await response.json() : null) as T;
  }
  const passes = (params: Record<string, string>) => rest<WalletPass[]>("wallet_passes", "GET", { select: PASS_FIELDS, ...params });
  return {
    async passBySerial(serial) { return (await passes({ serial: `eq.${serial}` }))[0] ?? null; },
    async passFor(playerId, teamId) { return (await passes({ player_id: `eq.${playerId}`, team_id: `eq.${teamId}` }))[0] ?? null; },
    async createPass(pass) {
      await rest("wallet_passes", "POST", { on_conflict: "player_id,team_id" }, pass, "resolution=ignore-duplicates,return=minimal");
      return (await passes({ player_id: `eq.${pass.player_id}`, team_id: `eq.${pass.team_id}` }))[0];
    },
    async setGoogleObject(serial, objectId) { await rest("wallet_passes", "PATCH", { serial: `eq.${serial}` }, { google_object_id: objectId }); },
    teamPasses: teamId => passes({ team_id: `eq.${teamId}` }),
    async touchPasses(serials, at) { if (serials.length) await rest("wallet_passes", "PATCH", { serial: inList(serials) }, { updated_at: at }); },
    async addDevice(device) {
      const existing = await rest<WalletDevice[]>("wallet_devices", "GET", { select: "device_id", device_id: `eq.${device.device_id}`, serial: `eq.${device.serial}` });
      await rest("wallet_devices", "POST", { on_conflict: "device_id,serial" }, device, "resolution=merge-duplicates,return=minimal");
      return existing.length ? "exists" : "created";
    },
    async removeDevice(deviceId, serial) { await rest("wallet_devices", "DELETE", { device_id: `eq.${deviceId}`, serial: `eq.${serial}` }); },
    async removePushToken(token) { await rest("wallet_devices", "DELETE", { push_token: `eq.${token}` }); },
    async devicesFor(serials) { return serials.length ? rest<WalletDevice[]>("wallet_devices", "GET", { select: "device_id,serial,push_token", serial: inList(serials) }) : []; },
    async devicePasses(deviceId) {
      const rows = await rest<{ serial: string }[]>("wallet_devices", "GET", { select: "serial", device_id: `eq.${deviceId}` });
      return rows.length ? passes({ serial: inList(rows.map(r => r.serial)) }) : [];
    },
    async publishedLineup(teamId, fixtureId) { return (await rest<PublishedLineup[]>("published_lineups", "GET", { select: "team_id,fixture_id,lineup_id,pairs,published_at", team_id: `eq.${teamId}`, fixture_id: `eq.${fixtureId}` }))[0] ?? null; },
    async publishLineup(row) { await rest("published_lineups", "POST", { on_conflict: "team_id,fixture_id" }, row, "resolution=merge-duplicates,return=minimal"); },
  };
}
export const walletStore = (): WalletStore => supabaseWalletStore(accountConfig());
```

- [ ] **Step 4: Comprobar que pasa**

Run: `pnpm exec tsx --test tests/wallet-store.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verificar y hacer commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`

```bash
git add src/lib/wallet-store.ts tests/wallet-store.test.ts
git commit -m "feat: almacén de tarjetas, dispositivos y convocatorias publicadas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Tarjeta de Apple (`pass.json` y firma)

**Files:**
- Create: `src/lib/wallet-apple.ts`
- Test: `tests/wallet-apple.test.ts`

**Interfaces:**
- Consumes: `WalletCardData` (Task 2), `AppleConfig` (Task 1)
- Produces:
  - `type ApplePassMeta = { serial: string; authToken: string; baseUrl: string; passTypeId: string; teamIdentifier: string }`
  - `applePassJson(card: WalletCardData, meta: ApplePassMeta): Record<string, unknown>`
  - `signApplePass(card: WalletCardData, meta: { serial: string; authToken: string; baseUrl: string }, config: AppleConfig): Promise<Buffer>`

- [ ] **Step 1: Escribir el test que falla**

`tests/wallet-apple.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { applePassJson } from "../src/lib/wallet-apple";
import type { WalletCardData } from "../src/domain/wallet-card";

const card: WalletCardData = { teamId: "a", playerSourceId: "1", teamLabel: "Equipo A", playerLine: "Carlos Martin · Revés", nextMatch: "J5 · Rival · Dom 18/10 10:00 · Local", lineup: "Convocado J5 · Pareja 2 con Juan Perez", lastResult: "J4 · Fito Raya A 7–5 Rival X", snpPoints: "20.313", teamPath: "/equipos/a/jornadas", actaPath: "/equipos/a/jornadas/40" };
const meta = { serial: "11111111-1111-4111-8111-111111111111", authToken: "t".repeat(43), baseUrl: "https://fito.example.com", passTypeId: "pass.com.fitoraya.equipo", teamIdentifier: "ABCDE12345" };

test("pass.json genérico con web service, colores y QR", () => {
  const json = applePassJson(card, meta);
  assert.equal(json.formatVersion, 1);
  assert.equal(json.passTypeIdentifier, "pass.com.fitoraya.equipo");
  assert.equal(json.teamIdentifier, "ABCDE12345");
  assert.equal(json.serialNumber, meta.serial);
  assert.equal(json.authenticationToken, meta.authToken);
  assert.equal(json.webServiceURL, "https://fito.example.com/api/wallet/apple");
  assert.equal(json.backgroundColor, "rgb(10, 24, 37)");
  assert.equal(json.foregroundColor, "rgb(242, 197, 0)");
  assert.deepEqual(json.barcodes, [{ format: "PKBarcodeFormatQR", message: "https://fito.example.com/mi-perfil", messageEncoding: "iso-8859-1" }]);
});
test("solo convocatoria y resultado avisan al cambiar", () => {
  const generic = applePassJson(card, meta).generic as Record<string, { key: string; value: string; changeMessage?: string }[]>;
  const fields = Object.values(generic).flat();
  assert.deepEqual(fields.filter(f => f.changeMessage).map(f => [f.key, f.changeMessage]), [["lineup", "%@"], ["result", "%@"]]);
  assert.equal(fields.find(f => f.key === "points")?.value, "20.313");
  assert.equal(fields.find(f => f.key === "acta")?.value, "https://fito.example.com/equipos/a/jornadas/40");
});
test("sin acta no hay campo de acta en el reverso", () => {
  const generic = applePassJson({ ...card, actaPath: null }, meta).generic as Record<string, { key: string }[]>;
  assert.equal(generic.backFields.some(f => f.key === "acta"), false);
});
```

- [ ] **Step 2: Comprobar que falla**

Run: `pnpm exec tsx --test tests/wallet-apple.test.ts`
Expected: FAIL, `Cannot find module`.

- [ ] **Step 3: Implementar**

`src/lib/wallet-apple.ts`:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PKPass } from "passkit-generator";
import type { WalletCardData } from "@/domain/wallet-card";
import type { AppleConfig } from "./wallet-config";
export type ApplePassMeta = { serial: string; authToken: string; baseUrl: string; passTypeId: string; teamIdentifier: string };
// Apple notifies on a field whose value changed only when it has a changeMessage.
export function applePassJson(card: WalletCardData, meta: ApplePassMeta): Record<string, unknown> {
  return {
    formatVersion: 1, passTypeIdentifier: meta.passTypeId, teamIdentifier: meta.teamIdentifier, serialNumber: meta.serial,
    authenticationToken: meta.authToken, webServiceURL: `${meta.baseUrl}/api/wallet/apple`,
    organizationName: "Escuela Fito Raya", description: `Tarjeta Fito Raya · ${card.teamLabel}`, logoText: "Fito Raya",
    backgroundColor: "rgb(10, 24, 37)", foregroundColor: "rgb(242, 197, 0)", labelColor: "rgb(255, 255, 255)",
    generic: {
      headerFields: [{ key: "team", label: "EQUIPO", value: card.teamId.toUpperCase() }],
      primaryFields: [{ key: "player", label: "JUGADOR", value: card.playerLine }],
      secondaryFields: [{ key: "next", label: "PRÓXIMO PARTIDO", value: card.nextMatch }, { key: "lineup", label: "CONVOCATORIA", value: card.lineup, changeMessage: "%@" }],
      auxiliaryFields: [{ key: "result", label: "ÚLTIMO RESULTADO", value: card.lastResult, changeMessage: "%@" }, { key: "points", label: "PUNTOS SNP", value: card.snpPoints }],
      backFields: [{ key: "web", label: "Web del equipo", value: `${meta.baseUrl}${card.teamPath}` }, ...(card.actaPath ? [{ key: "acta", label: "Acta de la última jornada", value: `${meta.baseUrl}${card.actaPath}` }] : [])],
    },
    barcodes: [{ format: "PKBarcodeFormatQR", message: `${meta.baseUrl}/mi-perfil`, messageEncoding: "iso-8859-1" }],
  };
}
let images: Promise<Record<string, Buffer>> | null = null;
function passImages() {
  images ??= Promise.all([readFile(join(process.cwd(), "public", "apple-touch-icon.png")), readFile(join(process.cwd(), "public", "logo-fito.png"))])
    .then(([icon, logo]) => ({ "icon.png": icon, "icon@2x.png": icon, "logo.png": logo, "logo@2x.png": logo }))
    .catch(error => { images = null; throw error; });
  return images;
}
export async function signApplePass(card: WalletCardData, meta: { serial: string; authToken: string; baseUrl: string }, config: AppleConfig): Promise<Buffer> {
  const json = applePassJson(card, { ...meta, passTypeId: config.passTypeId, teamIdentifier: config.teamId });
  const pass = new PKPass({ ...(await passImages()), "pass.json": Buffer.from(JSON.stringify(json)) }, { wwdr: config.wwdr, signerCert: config.cert, signerKey: config.key, ...(config.passphrase ? { signerKeyPassphrase: config.passphrase } : {}) });
  return pass.getAsBuffer();
}
```

- [ ] **Step 4: Comprobar que pasa**

Run: `pnpm exec tsx --test tests/wallet-apple.test.ts`
Expected: PASS (3 tests). Si `pnpm typecheck` se queja de los tipos del constructor de `PKPass`, consulta `node_modules/passkit-generator/lib/PKPass.d.ts` y ajusta el objeto de certificados a esa firma (los nombres son `wwdr`, `signerCert`, `signerKey`, `signerKeyPassphrase`).

- [ ] **Step 5: Verificar y hacer commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`

```bash
git add src/lib/wallet-apple.ts tests/wallet-apple.test.ts
git commit -m "feat: generación y firma de la tarjeta de Apple Wallet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Push a APNs

**Files:**
- Create: `src/lib/wallet-apns.ts`
- Test: `tests/wallet-apns.test.ts`

**Interfaces:**
- Consumes: `AppleConfig` (Task 1)
- Produces:
  - `type PushOutcome = "ok" | "unregistered" | "failed"`
  - `type PushSender = (token: string) => Promise<{ status: number; reason?: string }>`
  - `pushOutcome(response: { status: number; reason?: string }): PushOutcome`
  - `pushToDevices(tokens: string[], send: PushSender): Promise<Map<string, PushOutcome>>`. Elimina tokens duplicados; si el envío lanza un error, el resultado es `failed`.
  - `withApns<T>(config: AppleConfig, use: (send: PushSender) => Promise<T>): Promise<T>`: abre una sesión HTTP/2 con `api.push.apple.com` y la cierra al terminar.

- [ ] **Step 1: Escribir el test que falla**

`tests/wallet-apns.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { pushOutcome, pushToDevices } from "../src/lib/wallet-apns";

test("clasifica las respuestas de APNs", () => {
  assert.equal(pushOutcome({ status: 200 }), "ok");
  assert.equal(pushOutcome({ status: 410, reason: "Unregistered" }), "unregistered");
  assert.equal(pushOutcome({ status: 400, reason: "BadDeviceToken" }), "unregistered");
  assert.equal(pushOutcome({ status: 400, reason: "BadTopic" }), "failed");
  assert.equal(pushOutcome({ status: 0 }), "failed");
});
test("un envío por token, sin duplicados, y un error no corta el resto", async () => {
  const sent: string[] = [];
  const result = await pushToDevices(["a", "b", "a", "c"], async token => {
    sent.push(token);
    if (token === "b") throw new Error("socket");
    return { status: token === "c" ? 410 : 200 };
  });
  assert.deepEqual(sent, ["a", "b", "c"]);
  assert.deepEqual([...result], [["a", "ok"], ["b", "failed"], ["c", "unregistered"]]);
});
```

- [ ] **Step 2: Comprobar que falla**

Run: `pnpm exec tsx --test tests/wallet-apns.test.ts`
Expected: FAIL, `Cannot find module`.

- [ ] **Step 3: Implementar**

`src/lib/wallet-apns.ts`:

```ts
import { connect } from "node:http2";
import type { AppleConfig } from "./wallet-config";
export type PushOutcome = "ok" | "unregistered" | "failed";
export type PushSender = (token: string) => Promise<{ status: number; reason?: string }>;
// 410 and BadDeviceToken mean the pass was removed from that device: forget the token.
export function pushOutcome({ status, reason }: { status: number; reason?: string }): PushOutcome {
  if (status === 200) return "ok";
  if (status === 410 || (status === 400 && reason === "BadDeviceToken")) return "unregistered";
  return "failed";
}
export async function pushToDevices(tokens: string[], send: PushSender): Promise<Map<string, PushOutcome>> {
  const unique = [...new Set(tokens)];
  const results = await Promise.allSettled(unique.map(token => send(token)));
  return new Map(unique.map((token, i) => { const result = results[i]; return [token, result.status === "fulfilled" ? pushOutcome(result.value) : "failed"]; }));
}
// Wallet passes use an empty payload; the device then asks our web service what changed.
export async function withApns<T>(config: AppleConfig, use: (send: PushSender) => Promise<T>): Promise<T> {
  const session = connect("https://api.push.apple.com", { cert: config.cert, key: config.key, ...(config.passphrase ? { passphrase: config.passphrase } : {}) });
  session.on("error", () => { /* Each request reports its own failure. */ });
  const send: PushSender = token => new Promise(resolve => {
    let status = 0; let body = "";
    const request = session.request({ ":method": "POST", ":path": `/3/device/${token}`, "apns-topic": config.passTypeId, "content-type": "application/json" });
    request.setTimeout(10000, () => request.close());
    request.on("response", headers => { status = Number(headers[":status"]); });
    request.setEncoding("utf8");
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => { let reason: string | undefined; try { reason = JSON.parse(body).reason; } catch { reason = undefined; } resolve({ status, reason }); });
    request.on("error", () => resolve({ status: 0 }));
    request.end("{}");
  });
  try { return await use(send); } finally { session.close(); }
}
```

- [ ] **Step 4: Comprobar que pasa**

Run: `pnpm exec tsx --test tests/wallet-apns.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verificar y hacer commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`

```bash
git add src/lib/wallet-apns.ts tests/wallet-apns.test.ts
git commit -m "feat: avisos push de Apple Wallet por APNs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Google Wallet

**Files:**
- Create: `src/lib/wallet-google.ts`
- Test: `tests/wallet-google.test.ts`

**Interfaces:**
- Consumes: `WalletCardData` (Task 2), `GoogleConfig` (Task 1)
- Produces:
  - `type GoogleOutcome = "ok" | "rateLimited" | "missing" | "failed"`
  - `googleClassId(issuerId, teamId)` → `${issuerId}.fito-raya-${teamId}`
  - `googleObjectId(issuerId, serial)` → `${issuerId}.${serial}`
  - `googleObject(card, { issuerId, serial, baseUrl }): Record<string, unknown>`
  - `signJwt(claims: object, privateKey: string): string` (RS256)
  - `googleSaveUrl(card, { serial, baseUrl }, config: GoogleConfig, now?: number): string`
  - `googleWalletClient(config, fetchImpl?, clock?)` → `{ update(objectId: string, object: object, notice: { header: string; body: string } | null, messageId: string): Promise<GoogleOutcome> }`. El PATCH responde 404 cuando el jugador no guardó la tarjeta (`missing`); el `addMessage` responde 429 al superar el límite (`rateLimited`); cualquier otro error es `failed`. Nunca lanza excepciones.

- [ ] **Step 1: Escribir el test que falla**

`tests/wallet-google.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { googleObject, googleSaveUrl, googleWalletClient, signJwt } from "../src/lib/wallet-google";
import type { WalletCardData } from "../src/domain/wallet-card";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const config = { issuerId: "3388", clientEmail: "wallet@fito.iam.gserviceaccount.com", privateKey };
const card: WalletCardData = { teamId: "b", playerSourceId: "1", teamLabel: "Equipo B", playerLine: "Carlos Martin · Revés", nextMatch: "J5 · Rival · Dom 18/10 10:00 · Local", lineup: "No convocado en J5", lastResult: "Sin resultados todavía", snpPoints: "900", teamPath: "/equipos/b/jornadas", actaPath: null };
const meta = { serial: "11111111-1111-4111-8111-111111111111", baseUrl: "https://fito.example.com" };
const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());

test("objeto genérico con módulos de texto, enlace y QR", () => {
  const object = googleObject(card, { issuerId: "3388", ...meta }) as { id: string; classId: string; state: string; hexBackgroundColor: string; textModulesData: { id: string; body: string }[]; linksModuleData: { uris: unknown[] }; barcode: unknown };
  assert.equal(object.id, "3388.11111111-1111-4111-8111-111111111111");
  assert.equal(object.classId, "3388.fito-raya-b");
  assert.equal(object.state, "ACTIVE");
  assert.equal(object.hexBackgroundColor, "#0a1825");
  assert.deepEqual(object.textModulesData.map(m => [m.id, m.body]), [["next", card.nextMatch], ["lineup", card.lineup], ["result", card.lastResult], ["points", "900"]]);
  assert.deepEqual(object.linksModuleData.uris, [{ id: "web", uri: "https://fito.example.com/equipos/b/jornadas", description: "Web del equipo" }]);
  assert.deepEqual(object.barcode, { type: "QR_CODE", value: "https://fito.example.com/mi-perfil" });
});
test("JWT de guardar firmado RS256 con clase y objeto", () => {
  const url = googleSaveUrl(card, meta, config, 1_760_000_000_000);
  assert.match(url, /^https:\/\/pay\.google\.com\/gp\/v\/save\//);
  const [header, claims, signature] = url.split("/").pop()!.split(".");
  assert.deepEqual(decode(header), { alg: "RS256", typ: "JWT" });
  const body = decode(claims);
  assert.equal(body.iss, config.clientEmail); assert.equal(body.aud, "google"); assert.equal(body.typ, "savetowallet");
  assert.equal(body.iat, 1_760_000_000); assert.deepEqual(body.origins, ["https://fito.example.com"]);
  assert.deepEqual(body.payload.genericClasses, [{ id: "3388.fito-raya-b" }]);
  assert.equal(body.payload.genericObjects[0].id, "3388.11111111-1111-4111-8111-111111111111");
  assert.equal(createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, signature, "base64url"), true);
});
test("signJwt produce tres partes verificables", () => {
  const [h, c, s] = signJwt({ a: 1 }, privateKey).split(".");
  assert.deepEqual(decode(c), { a: 1 });
  assert.equal(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, s, "base64url"), true);
});
test("cliente: token cacheado, PATCH + addMessage y resultados", async () => {
  const calls: { url: string; method: string; body: string }[] = [];
  let patchStatus = 200; let messageStatus = 200;
  const fake = (async (input: URL | string, init?: RequestInit) => {
    const url = String(input); calls.push({ url, method: init?.method ?? "GET", body: String(init?.body ?? "") });
    if (url.startsWith("https://oauth2.googleapis.com/token")) return Response.json({ access_token: "tok", expires_in: 3600 });
    return new Response("{}", { status: url.endsWith("/addMessage") ? messageStatus : patchStatus });
  }) as typeof fetch;
  const client = googleWalletClient(config, fake, () => 1_760_000_000_000);
  const notice = { header: "Convocatoria J5", body: "No convocado en J5" };
  assert.equal(await client.update("3388.s", { id: "3388.s" }, notice, "lineup-50-1"), "ok");
  assert.equal(calls.filter(c => c.url.includes("oauth2")).length, 1);
  assert.equal(calls[1].method, "PATCH");
  assert.match(calls[1].url, /\/genericObject\/3388\.s$/);
  assert.deepEqual(JSON.parse(calls[2].body), { message: { id: "lineup-50-1", header: "Convocatoria J5", body: "No convocado en J5", messageType: "TEXT_AND_NOTIFY" } });
  assert.equal(await client.update("3388.s", {}, null, "x"), "ok");
  assert.equal(calls.filter(c => c.url.includes("oauth2")).length, 1);
  messageStatus = 429; assert.equal(await client.update("3388.s", {}, notice, "y"), "rateLimited");
  patchStatus = 404; assert.equal(await client.update("3388.s", {}, notice, "z"), "missing");
  patchStatus = 500; assert.equal(await client.update("3388.s", {}, notice, "w"), "failed");
  const broken = googleWalletClient(config, (async () => { throw new Error("red"); }) as typeof fetch);
  assert.equal(await broken.update("3388.s", {}, null, "v"), "failed");
});
```

- [ ] **Step 2: Comprobar que falla**

Run: `pnpm exec tsx --test tests/wallet-google.test.ts`
Expected: FAIL, `Cannot find module`.

- [ ] **Step 3: Implementar**

`src/lib/wallet-google.ts`:

```ts
import { createSign } from "node:crypto";
import type { TeamId } from "@/domain/types";
import type { WalletCardData } from "@/domain/wallet-card";
import type { GoogleConfig } from "./wallet-config";
const API = "https://walletobjects.googleapis.com/walletobjects/v1";
export type GoogleOutcome = "ok" | "rateLimited" | "missing" | "failed";
const text = (value: string) => ({ defaultValue: { language: "es", value } });
export const googleClassId = (issuerId: string, teamId: TeamId) => `${issuerId}.fito-raya-${teamId}`;
export const googleObjectId = (issuerId: string, serial: string) => `${issuerId}.${serial}`;
export function googleObject(card: WalletCardData, { issuerId, serial, baseUrl }: { issuerId: string; serial: string; baseUrl: string }): Record<string, unknown> {
  return {
    id: googleObjectId(issuerId, serial), classId: googleClassId(issuerId, card.teamId), state: "ACTIVE", hexBackgroundColor: "#0a1825",
    logo: { sourceUri: { uri: `${baseUrl}/logo-fito.png` } },
    cardTitle: text(`Fito Raya · ${card.teamLabel}`), header: text(card.playerLine), subheader: text(card.teamLabel),
    textModulesData: [
      { id: "next", header: "Próximo partido", body: card.nextMatch },
      { id: "lineup", header: "Convocatoria", body: card.lineup },
      { id: "result", header: "Último resultado", body: card.lastResult },
      { id: "points", header: "Puntos SNP", body: card.snpPoints },
    ],
    linksModuleData: { uris: [{ id: "web", uri: `${baseUrl}${card.teamPath}`, description: "Web del equipo" }, ...(card.actaPath ? [{ id: "acta", uri: `${baseUrl}${card.actaPath}`, description: "Acta de la última jornada" }] : [])] },
    barcode: { type: "QR_CODE", value: `${baseUrl}/mi-perfil` },
  };
}
export function signJwt(claims: object, privateKey: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const data = `${encode({ alg: "RS256", typ: "JWT" })}.${encode(claims)}`;
  return `${data}.${createSign("RSA-SHA256").update(data).sign(privateKey, "base64url")}`;
}
// Saving the link creates the team class and the player object in Google Wallet.
export function googleSaveUrl(card: WalletCardData, meta: { serial: string; baseUrl: string }, config: GoogleConfig, now = Date.now()): string {
  const claims = { iss: config.clientEmail, aud: "google", typ: "savetowallet", iat: Math.floor(now / 1000), origins: [meta.baseUrl], payload: { genericClasses: [{ id: googleClassId(config.issuerId, card.teamId) }], genericObjects: [googleObject(card, { issuerId: config.issuerId, ...meta })] } };
  return `https://pay.google.com/gp/v/save/${signJwt(claims, config.privateKey)}`;
}
export function googleWalletClient(config: GoogleConfig, fetchImpl: typeof fetch = fetch, clock: () => number = Date.now) {
  let token: { value: string; expires: number } | null = null;
  async function accessToken() {
    if (token && token.expires > clock() + 60000) return token.value;
    const now = Math.floor(clock() / 1000);
    const assertion = signJwt({ iss: config.clientEmail, scope: "https://www.googleapis.com/auth/wallet_object.issuer", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }, config.privateKey);
    const response = await fetchImpl("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Google no ha aceptado la cuenta de servicio.");
    const data = await response.json();
    token = { value: data.access_token, expires: clock() + data.expires_in * 1000 };
    return token.value;
  }
  async function call(path: string, method: string, body: object) {
    return fetchImpl(`${API}${path}`, { method, headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  }
  return {
    async update(objectId: string, object: object, notice: { header: string; body: string } | null, messageId: string): Promise<GoogleOutcome> {
      try {
        const path = `/genericObject/${encodeURIComponent(objectId)}`;
        const patched = await call(path, "PATCH", object);
        if (patched.status === 404) return "missing";
        if (!patched.ok) return "failed";
        if (!notice) return "ok";
        const message = await call(`${path}/addMessage`, "POST", { message: { id: messageId, header: notice.header, body: notice.body, messageType: "TEXT_AND_NOTIFY" } });
        return message.ok ? "ok" : message.status === 429 ? "rateLimited" : "failed";
      } catch { return "failed"; }
    },
  };
}
```

- [ ] **Step 4: Comprobar que pasa**

Run: `pnpm exec tsx --test tests/wallet-google.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verificar y hacer commit**

Run: `pnpm typecheck && pnpm lint && pnpm test && node scripts/check-repository.mjs`
Expected: `findings: []` (las claves de los tests se generan en memoria).

```bash
git add src/lib/wallet-google.ts tests/wallet-google.test.ts
git commit -m "feat: tarjeta y avisos de Google Wallet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Web service de Apple

**Files:**
- Create: `src/lib/wallet-apple-service.ts`
- Create: `src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serial]/route.ts`
- Create: `src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/route.ts`
- Create: `src/app/api/wallet/apple/v1/log/route.ts`
- Test: `tests/wallet-apple-service.test.ts`

La ruta `passes/[passTypeId]/[serial]` va en la Task 9, porque necesita generar la tarjeta.

**Interfaces:**
- Consumes: `WalletStore`, `WalletPass`, `memoryWalletStore` (Task 4), `appleConfig` (Task 1)
- Produces:
  - `validSerial(value: string): boolean`
  - `authorizedPass(store, { passTypeId, expectedType, serial, authorization }): Promise<WalletPass | null>`. Compara la cabecera `ApplePass <token>` con `timingSafeEqual`.
  - `registerDevice(store, { deviceId, passTypeId, expectedType, serial, authorization, pushToken }): Promise<200 | 201 | 400 | 401>`
  - `unregisterDevice(store, { deviceId, passTypeId, expectedType, serial, authorization }): Promise<200 | 400 | 401>`
  - `updatedSerials(store, { deviceId, passTypeId, expectedType, since }): Promise<{ status: 200; body: { serialNumbers: string[]; lastUpdated: string } } | { status: 204 | 400 }>`

- [ ] **Step 1: Leer la documentación de rutas de Next**

Run: `sed -n 300,340p node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
Comprueba que los segmentos dinámicos se leen con `{ params }: { params: Promise<{ … }> }` y que una carpeta puede tener `route.ts` y también subcarpetas dinámicas con su propio `route.ts`.

- [ ] **Step 2: Escribir el test que falla**

`tests/wallet-apple-service.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { authorizedPass, registerDevice, unregisterDevice, updatedSerials } from "../src/lib/wallet-apple-service";
import { memoryWalletStore, type WalletPass } from "../src/lib/wallet-store";

const TYPE = "pass.com.fitoraya.equipo";
const serial = "11111111-1111-4111-8111-111111111111";
const token = "t".repeat(43);
async function setup() {
  const store = memoryWalletStore();
  const pass: WalletPass = { serial, player_id: "1", team_id: "a", auth_token: token, google_object_id: null, updated_at: "2026-10-11T10:00:00.000Z" };
  await store.createPass(pass);
  return store;
}
const base = { deviceId: "abc123", passTypeId: TYPE, expectedType: TYPE, serial, authorization: `ApplePass ${token}` };

test("autorización: token, tipo y serial", async () => {
  const store = await setup();
  assert.equal((await authorizedPass(store, base))?.serial, serial);
  assert.equal(await authorizedPass(store, { ...base, authorization: `ApplePass ${"x".repeat(43)}` }), null);
  assert.equal(await authorizedPass(store, { ...base, authorization: "ApplePass corto" }), null);
  assert.equal(await authorizedPass(store, { ...base, authorization: null }), null);
  assert.equal(await authorizedPass(store, { ...base, passTypeId: "pass.otro" }), null);
  assert.equal(await authorizedPass(store, { ...base, serial: "../../etc" }), null);
});
test("registro 201, repetido 200, sin token 401, datos malos 400 y baja", async () => {
  const store = await setup();
  assert.equal(await registerDevice(store, { ...base, pushToken: "a1b2" }), 201);
  assert.equal(await registerDevice(store, { ...base, pushToken: "a1b2" }), 200);
  assert.equal(await registerDevice(store, { ...base, authorization: null, pushToken: "a1b2" }), 401);
  assert.equal(await registerDevice(store, { ...base, pushToken: 42 }), 400);
  assert.equal(await registerDevice(store, { ...base, deviceId: "no válido", pushToken: "a1b2" }), 400);
  assert.equal(store.devices.length, 1);
  assert.equal(await unregisterDevice(store, { ...base, authorization: null }), 401);
  assert.equal(await unregisterDevice(store, base), 200);
  assert.equal(store.devices.length, 0);
});
test("tarjetas actualizadas: sin marca, marca vieja, futura y no numérica", async () => {
  const store = await setup();
  await registerDevice(store, { ...base, pushToken: "a1b2" });
  const updatedAt = Date.parse("2026-10-11T10:00:00.000Z");
  const input = { deviceId: "abc123", passTypeId: TYPE, expectedType: TYPE };
  assert.deepEqual(await updatedSerials(store, { ...input, since: null }), { status: 200, body: { serialNumbers: [serial], lastUpdated: String(updatedAt) } });
  assert.deepEqual(await updatedSerials(store, { ...input, since: String(updatedAt - 1) }), { status: 200, body: { serialNumbers: [serial], lastUpdated: String(updatedAt) } });
  assert.deepEqual(await updatedSerials(store, { ...input, since: String(updatedAt) }), { status: 204 });
  assert.deepEqual(await updatedSerials(store, { ...input, since: "9999999999999" }), { status: 204 });
  assert.deepEqual(await updatedSerials(store, { ...input, since: "ayer" }), { status: 200, body: { serialNumbers: [serial], lastUpdated: String(updatedAt) } });
  assert.deepEqual(await updatedSerials(store, { ...input, deviceId: "otro" }), { status: 204 });
  assert.deepEqual(await updatedSerials(store, { ...input, passTypeId: "pass.otro" }), { status: 400 });
});
```

- [ ] **Step 3: Comprobar que falla**

Run: `pnpm exec tsx --test tests/wallet-apple-service.test.ts`
Expected: FAIL, `Cannot find module`.

- [ ] **Step 4: Implementar el servicio**

`src/lib/wallet-apple-service.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import type { WalletPass, WalletStore } from "./wallet-store";
const SERIAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DEVICE = /^[A-Za-z0-9]{1,64}$/;
const PUSH_TOKEN = /^[A-Fa-f0-9]{1,200}$/;
export const validSerial = (value: string) => SERIAL.test(value);
type PassRequest = { passTypeId: string; expectedType: string; serial: string; authorization: string | null };
// Wallet sends "Authorization: ApplePass <authenticationToken>" on every pass-specific call.
export async function authorizedPass(store: WalletStore, { passTypeId, expectedType, serial, authorization }: PassRequest): Promise<WalletPass | null> {
  if (passTypeId !== expectedType || !validSerial(serial) || !authorization?.startsWith("ApplePass ")) return null;
  const pass = await store.passBySerial(serial); if (!pass) return null;
  const expected = Buffer.from(pass.auth_token); const provided = Buffer.from(authorization.slice("ApplePass ".length));
  return expected.length === provided.length && timingSafeEqual(expected, provided) ? pass : null;
}
export async function registerDevice(store: WalletStore, input: PassRequest & { deviceId: string; pushToken: unknown }): Promise<200 | 201 | 400 | 401> {
  if (!DEVICE.test(input.deviceId)) return 400;
  const pass = await authorizedPass(store, input); if (!pass) return 401;
  if (typeof input.pushToken !== "string" || !PUSH_TOKEN.test(input.pushToken)) return 400;
  return (await store.addDevice({ device_id: input.deviceId, serial: pass.serial, push_token: input.pushToken })) === "created" ? 201 : 200;
}
export async function unregisterDevice(store: WalletStore, input: PassRequest & { deviceId: string }): Promise<200 | 400 | 401> {
  if (!DEVICE.test(input.deviceId)) return 400;
  const pass = await authorizedPass(store, input); if (!pass) return 401;
  await store.removeDevice(input.deviceId, pass.serial); return 200;
}
// The update tag is the newest updated_at in epoch milliseconds; a missing or bad tag lists every pass.
export async function updatedSerials(store: WalletStore, { deviceId, passTypeId, expectedType, since }: { deviceId: string; passTypeId: string; expectedType: string; since: string | null }): Promise<{ status: 200; body: { serialNumbers: string[]; lastUpdated: string } } | { status: 204 | 400 }> {
  if (passTypeId !== expectedType || !DEVICE.test(deviceId)) return { status: 400 };
  const after = since && /^\d{1,15}$/.test(since) ? Number(since) : 0;
  const updated = (await store.devicePasses(deviceId)).filter(p => Date.parse(p.updated_at) > after);
  if (!updated.length) return { status: 204 };
  return { status: 200, body: { serialNumbers: updated.map(p => p.serial), lastUpdated: String(Math.max(...updated.map(p => Date.parse(p.updated_at)))) } };
}
```

- [ ] **Step 5: Comprobar que pasa**

Run: `pnpm exec tsx --test tests/wallet-apple-service.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Rutas finas**

`src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serial]/route.ts`:

```ts
import { appleConfig } from "@/lib/wallet-config";
import { walletStore } from "@/lib/wallet-store";
import { registerDevice, unregisterDevice } from "@/lib/wallet-apple-service";
export const runtime = "nodejs";
type Context = { params: Promise<{ deviceId: string; passTypeId: string; serial: string }> };
export async function POST(request: Request, { params }: Context) {
  const config = appleConfig(); if (!config) return new Response(null, { status: 404 });
  const { deviceId, passTypeId, serial } = await params;
  const text = await request.text(); let pushToken: unknown = null;
  if (text.length <= 1000) { try { pushToken = JSON.parse(text).pushToken; } catch { pushToken = null; } }
  try { return new Response(null, { status: await registerDevice(walletStore(), { deviceId, passTypeId, expectedType: config.passTypeId, serial, authorization: request.headers.get("authorization"), pushToken }) }); }
  catch { return new Response(null, { status: 503 }); }
}
export async function DELETE(request: Request, { params }: Context) {
  const config = appleConfig(); if (!config) return new Response(null, { status: 404 });
  const { deviceId, passTypeId, serial } = await params;
  try { return new Response(null, { status: await unregisterDevice(walletStore(), { deviceId, passTypeId, expectedType: config.passTypeId, serial, authorization: request.headers.get("authorization") }) }); }
  catch { return new Response(null, { status: 503 }); }
}
```

`src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/route.ts`:

```ts
import { appleConfig } from "@/lib/wallet-config";
import { walletStore } from "@/lib/wallet-store";
import { updatedSerials } from "@/lib/wallet-apple-service";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ deviceId: string; passTypeId: string }> }) {
  const config = appleConfig(); if (!config) return new Response(null, { status: 404 });
  const { deviceId, passTypeId } = await params;
  try {
    const result = await updatedSerials(walletStore(), { deviceId, passTypeId, expectedType: config.passTypeId, since: new URL(request.url).searchParams.get("passesUpdatedSince") });
    return result.status === 200 ? Response.json(result.body, { headers: { "Cache-Control": "no-store" } }) : new Response(null, { status: result.status });
  } catch { return new Response(null, { status: 503 }); }
}
```

`src/app/api/wallet/apple/v1/log/route.ts`:

```ts
export const runtime = "nodejs";
// Wallet reports web service problems here; keep them in the server log for debugging.
export async function POST(request: Request) {
  const text = await request.text();
  if (text.length <= 10000) { try { console.warn("[wallet] Apple:", JSON.parse(text).logs); } catch { /* Ignore malformed reports. */ } }
  return new Response(null, { status: 200 });
}
```

- [ ] **Step 7: Verificar y hacer commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`

```bash
git add src/lib/wallet-apple-service.ts src/app/api/wallet/apple/v1 tests/wallet-apple-service.test.ts
git commit -m "feat: web service de Apple Wallet para registrar dispositivos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Emisión de tarjetas y descarga

**Files:**
- Create: `src/lib/wallet-issue.ts`
- Create: `src/app/api/wallet/route.ts`
- Create: `src/app/api/wallet/apple/route.ts`
- Create: `src/app/api/wallet/google/route.ts`
- Create: `src/app/api/wallet/apple/v1/passes/[passTypeId]/[serial]/route.ts`
- Test: `tests/wallet-issue.test.ts`

**Interfaces:**
- Consumes: `clubRepository` (`src/data/repository.ts`), `lastPlayedFixture` (`src/domain/pending-results.ts`), `buildWalletCard`, `TeamCardContext` (Task 2), `teamResultScore` (Task 3), `WalletStore` (Task 4), `signApplePass` (Task 5), `googleObjectId`, `googleSaveUrl` (Task 7), `authorizedPass` (Task 8), `currentAccount`, `AccountError` (`account-auth`), `playerLink` (`account-profile`)
- Produces:
  - `teamContext(teamId, players: Player[], fixtures: Fixture[], store, now): Promise<TeamCardContext>`. Testeable: recibe los datos ya cargados.
  - `loadTeamContext(teamId: TeamId, store: WalletStore, now?: number): Promise<TeamCardContext>`
  - `ensurePass(store, playerId: string, teamId: TeamId): Promise<WalletPass>`
  - `walletTeams(playerId: string): Promise<TeamId[]>`
  - `requireWalletPlayer(team: string | null): Promise<{ playerId: string; teamId: TeamId }>`
  - `applePassBuffer(pass: WalletPass, store: WalletStore): Promise<Buffer | null>` (null si falta config o el jugador ya no está en la plantilla)
  - `googleSaveLink(pass: WalletPass, store: WalletStore): Promise<string | null>`

- [ ] **Step 1: Escribir el test que falla**

`tests/wallet-issue.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { ensurePass, teamContext } from "../src/lib/wallet-issue";
import { memoryWalletStore } from "../src/lib/wallet-store";
import type { Fixture, Player } from "../src/domain/types";

const player = (id: string, sourceId?: string): Player => ({ id, sourceId, name: `P${id}`, teamId: "a", points: 10, position: null });
const fixture = (id: string, round: number, date: string, status: Fixture["status"], score: Fixture["score"] = null): Fixture => ({ id, teamId: "a", round, opponent: `R${round}`, date, venue: "", home: true, status, matches: [], score });

test("ensurePass crea una sola tarjeta con serial UUID y token largo", async () => {
  const store = memoryWalletStore();
  const first = await ensurePass(store, "1", "a");
  assert.match(first.serial, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(first.auth_token.length, 43);
  assert.equal((await ensurePass(store, "1", "a")).serial, first.serial);
  assert.notEqual((await ensurePass(store, "1", "b")).serial, first.serial);
});
test("contexto: próximo pendiente, convocatoria publicada y último resultado SNP", async () => {
  const store = memoryWalletStore();
  await store.publishLineup({ team_id: "a", fixture_id: "60", lineup_id: null, pairs: [{ id: "p", players: ["a-1", null] }], published_at: "x" });
  const fixtures = [fixture("40", 4, "2026-10-04T08:00:00.000Z", "played", [3, 9]), fixture("60", 6, "2026-10-25T08:00:00.000Z", "pending")];
  const ctx = await teamContext("a", [player("a-1", "1"), player("a-2")], fixtures, store, Date.parse("2026-10-11T00:00:00Z"), async () => null);
  assert.deepEqual(ctx.players.map(p => p.sourceId), ["1"]);
  assert.equal(ctx.next?.id, "60");
  assert.deepEqual(ctx.published, { fixtureId: "60", pairs: [{ id: "p", players: ["a-1", null] }] });
  assert.deepEqual(ctx.last, { fixtureId: "40", round: 4, opponent: "R4", ours: 3, theirs: 9 });
});
test("contexto: sin resultado conocido no hay último resultado", async () => {
  const fixtures = [fixture("40", 4, "2026-10-04T08:00:00.000Z", "pending")];
  const ctx = await teamContext("a", [player("a-1", "1")], fixtures, memoryWalletStore(), Date.parse("2026-10-11T00:00:00Z"), async () => null);
  assert.equal(ctx.last, null);
  assert.equal(ctx.next?.id, "40");
  assert.equal(ctx.published, null);
});
```

- [ ] **Step 2: Comprobar que falla**

Run: `pnpm exec tsx --test tests/wallet-issue.test.ts`
Expected: FAIL, `Cannot find module`.

- [ ] **Step 3: Implementar**

`src/lib/wallet-issue.ts`:

```ts
import { randomBytes, randomUUID } from "node:crypto";
import { clubRepository } from "@/data/repository";
import { lastPlayedFixture } from "@/domain/pending-results";
import { buildWalletCard, type TeamCardContext } from "@/domain/wallet-card";
import type { Fixture, Player, TeamId } from "@/domain/types";
import { AccountError, currentAccount } from "./account-auth";
import { playerLink } from "./account-profile";
import { teamResultScore } from "./team-result-service";
import { appleConfig, googleConfig, publicBaseUrl } from "./wallet-config";
import { signApplePass } from "./wallet-apple";
import { googleObjectId, googleSaveUrl } from "./wallet-google";
import type { WalletPass, WalletStore } from "./wallet-store";
type ScoreOf = (teamId: TeamId, fixture: Fixture) => Promise<[number, number] | null>;
// Our side's score for a fixture: app/acta pairs first, then SNP's published score.
const fallbackScore = (fixture: Fixture): [number, number] | null => fixture.score ? (fixture.home ? fixture.score : [fixture.score[1], fixture.score[0]]) : null;
export async function teamContext(teamId: TeamId, players: Player[], fixtures: Fixture[], store: WalletStore, now: number, scoreOf: ScoreOf = teamResultScore): Promise<TeamCardContext> {
  const next = fixtures.find(f => f.status === "pending") ?? null;
  const last = lastPlayedFixture(fixtures, now);
  const [published, score] = await Promise.all([next ? store.publishedLineup(teamId, next.id) : null, last ? scoreOf(teamId, last).catch(() => null).then(s => s ?? fallbackScore(last)) : null]);
  return {
    teamId,
    players: players.filter(p => p.sourceId).map(p => ({ id: p.id, sourceId: p.sourceId!, name: p.name, position: p.position, points: p.points })),
    next: next && { id: next.id, round: next.round, opponent: next.opponent, date: next.date, home: next.home },
    published: published && { fixtureId: published.fixture_id, pairs: published.pairs },
    last: last && score ? { fixtureId: last.id, round: last.round, opponent: last.opponent, ours: score[0], theirs: score[1] } : null,
  };
}
export async function loadTeamContext(teamId: TeamId, store: WalletStore, now = Date.now()): Promise<TeamCardContext> {
  const [players, fixtures] = await Promise.all([clubRepository.getPlayers(teamId), clubRepository.getFixtures(teamId)]);
  return teamContext(teamId, players, fixtures, store, now);
}
export async function ensurePass(store: WalletStore, playerId: string, teamId: TeamId): Promise<WalletPass> {
  return (await store.passFor(playerId, teamId)) ?? store.createPass({ serial: randomUUID(), player_id: playerId, team_id: teamId, auth_token: randomBytes(32).toString("base64url"), google_object_id: null, updated_at: new Date().toISOString() });
}
export async function walletTeams(playerId: string): Promise<TeamId[]> {
  const teams: TeamId[] = [];
  for (const teamId of ["a", "b"] as const) if ((await clubRepository.getPlayers(teamId)).some(p => p.sourceId === playerId)) teams.push(teamId);
  return teams;
}
export async function requireWalletPlayer(team: string | null): Promise<{ playerId: string; teamId: TeamId }> {
  if (team !== "a" && team !== "b") throw new AccountError("Equipo no válido.");
  const user = await currentAccount(); if (!user) throw new AccountError("Inicia sesión para añadir tu tarjeta.", 401);
  if (user.role !== "player") throw new AccountError("La tarjeta es solo para jugadores.", 403);
  const link = await playerLink(user.id); if (!link) throw new AccountError("Vincula primero tu ficha de jugador.", 403);
  if (!(await walletTeams(link.player_id)).includes(team)) throw new AccountError("No estás en la plantilla de este equipo.", 403);
  return { playerId: link.player_id, teamId: team };
}
export async function applePassBuffer(pass: WalletPass, store: WalletStore): Promise<Buffer | null> {
  const config = appleConfig(); const baseUrl = publicBaseUrl(); if (!config || !baseUrl) return null;
  const card = buildWalletCard(await loadTeamContext(pass.team_id, store), pass.player_id);
  return card ? signApplePass(card, { serial: pass.serial, authToken: pass.auth_token, baseUrl }, config) : null;
}
export async function googleSaveLink(pass: WalletPass, store: WalletStore): Promise<string | null> {
  const config = googleConfig(); const baseUrl = publicBaseUrl(); if (!config || !baseUrl) return null;
  const card = buildWalletCard(await loadTeamContext(pass.team_id, store), pass.player_id); if (!card) return null;
  if (!pass.google_object_id) await store.setGoogleObject(pass.serial, googleObjectId(config.issuerId, pass.serial));
  return googleSaveUrl(card, { serial: pass.serial, baseUrl }, config);
}
```

Nota: `teamResultScore` (Task 3) ya incluye el respaldo de `fixture.score`. `fallbackScore` se repite aquí a propósito, para cuando `scoreOf` inyectado devuelve `null` en los tests o lanza un error de red.

- [ ] **Step 4: Comprobar que pasa**

Run: `pnpm exec tsx --test tests/wallet-issue.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Rutas**

`src/app/api/wallet/route.ts`:

```ts
import { accountFailure, accountReply, currentAccount } from "@/lib/account-auth";
import { playerLink } from "@/lib/account-profile";
import { walletAvailability } from "@/lib/wallet-config";
import { walletTeams } from "@/lib/wallet-issue";
export const runtime = "nodejs";
// What the profile needs to show the Wallet buttons: enabled platforms and the player's teams.
export async function GET() {
  try {
    const user = await currentAccount();
    if (!user) return accountReply({ error: "Inicia sesión para acceder a la web." }, 401);
    const availability = walletAvailability();
    if (user.role !== "player" || (!availability.apple && !availability.google)) return accountReply({ ...availability, teams: [] });
    const link = await playerLink(user.id);
    return accountReply({ ...availability, teams: link ? await walletTeams(link.player_id) : [] });
  } catch (error) { return accountFailure(error); }
}
```

`src/app/api/wallet/apple/route.ts`:

```ts
import { accountFailure, AccountError } from "@/lib/account-auth";
import { walletStore } from "@/lib/wallet-store";
import { applePassBuffer, ensurePass, requireWalletPlayer } from "@/lib/wallet-issue";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { playerId, teamId } = await requireWalletPlayer(new URL(request.url).searchParams.get("team"));
    const store = walletStore();
    const buffer = await applePassBuffer(await ensurePass(store, playerId, teamId), store);
    if (!buffer) throw new AccountError("Apple Wallet aún no está configurado.", 404);
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.apple.pkpass", "Content-Disposition": `attachment; filename="fito-raya-${teamId}.pkpass"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return accountFailure(error); }
}
```

`src/app/api/wallet/google/route.ts`:

```ts
import { accountFailure, AccountError } from "@/lib/account-auth";
import { walletStore } from "@/lib/wallet-store";
import { ensurePass, googleSaveLink, requireWalletPlayer } from "@/lib/wallet-issue";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { playerId, teamId } = await requireWalletPlayer(new URL(request.url).searchParams.get("team"));
    const store = walletStore();
    const url = await googleSaveLink(await ensurePass(store, playerId, teamId), store);
    if (!url) throw new AccountError("Google Wallet aún no está configurado.", 404);
    return new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "private, no-store" } });
  } catch (error) { return accountFailure(error); }
}
```

`src/app/api/wallet/apple/v1/passes/[passTypeId]/[serial]/route.ts`:

```ts
import { appleConfig } from "@/lib/wallet-config";
import { walletStore } from "@/lib/wallet-store";
import { authorizedPass } from "@/lib/wallet-apple-service";
import { applePassBuffer } from "@/lib/wallet-issue";
export const runtime = "nodejs";
// Always rebuilt from current data; 404 if the player left the roster (Wallet keeps the old pass).
export async function GET(request: Request, { params }: { params: Promise<{ passTypeId: string; serial: string }> }) {
  const config = appleConfig(); if (!config) return new Response(null, { status: 404 });
  const { passTypeId, serial } = await params;
  try {
    const store = walletStore();
    const pass = await authorizedPass(store, { passTypeId, expectedType: config.passTypeId, serial, authorization: request.headers.get("authorization") });
    if (!pass) return new Response(null, { status: 401 });
    const buffer = await applePassBuffer(pass, store);
    if (!buffer) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.apple.pkpass", "Last-Modified": new Date(pass.updated_at).toUTCString(), "Cache-Control": "no-store" } });
  } catch { return new Response(null, { status: 503 }); }
}
```

- [ ] **Step 6: Verificar y hacer commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`

```bash
git add src/lib/wallet-issue.ts src/app/api/wallet tests/wallet-issue.test.ts
git commit -m "feat: descarga de la tarjeta para Apple y Google Wallet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Orquestación del aviso

**Files:**
- Create: `src/domain/wallet-ui.ts` (solo el tipo `NotifySummary` en esta tarea; la Task 12 añade las funciones)
- Create: `src/lib/wallet-notify.ts`
- Test: `tests/wallet-notify.test.ts`

**Interfaces:**
- Consumes: `buildWalletCard`, `walletNotice`, `NotifyKind`, `TeamCardContext`, `WalletCardData` (Task 2), `PushOutcome` (Task 6), `GoogleOutcome` (Task 7), `WalletStore`, `WalletPass` (Task 4)
- Produces:
  - En `src/domain/wallet-ui.ts`: `type NotifySummary = { total: number; withoutPass: number; apple: { enabled: boolean; ok: number; failed: number }; google: { enabled: boolean; ok: number; failed: number; rateLimited: number } }`
  - `type NotifyChannels = { apple: ((tokens: string[]) => Promise<Map<string, PushOutcome>>) | null; google: ((pass: WalletPass, card: WalletCardData, notice: { header: string; body: string } | null) => Promise<GoogleOutcome>) | null }`
  - `notifyTeam({ store, ctx, kind, channels, now }: { store: WalletStore; ctx: TeamCardContext; kind: NotifyKind; channels: NotifyChannels; now: Date }): Promise<NotifySummary>`

Reglas: solo cuentan las tarjetas del equipo de `ctx` cuyo jugador sigue en `ctx.players`. Google solo actúa sobre las tarjetas con `google_object_id`, y una respuesta `missing` no cuenta como enviada ni como error. Con el canal de Apple activo, se marca `updated_at = now` en todas las tarjetas del equipo, se hace push a sus dispositivos y los tokens `unregistered` se borran sin contar como error.

- [ ] **Step 1: Escribir el test que falla**

`tests/wallet-notify.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { notifyTeam, type NotifyChannels } from "../src/lib/wallet-notify";
import { memoryWalletStore, type WalletPass } from "../src/lib/wallet-store";
import type { TeamCardContext } from "../src/domain/wallet-card";
import type { PushOutcome } from "../src/lib/wallet-apns";

const ctx: TeamCardContext = {
  teamId: "a",
  players: [{ id: "a-1", sourceId: "1", name: "Uno", position: null, points: 1 }, { id: "a-2", sourceId: "2", name: "Dos", position: null, points: 1 }, { id: "a-3", sourceId: "3", name: "Tres", position: null, points: 1 }],
  next: { id: "50", round: 5, opponent: "Rival", date: "", home: true },
  published: { fixtureId: "50", pairs: [{ id: "p", players: ["a-1", "a-2"] }] },
  last: null,
};
const uuid = (n: number) => `${String(n).repeat(8)}-1111-4111-8111-111111111111`;
const pass = (n: number, playerId: string, team: "a" | "b", google: boolean): WalletPass => ({ serial: uuid(n), player_id: playerId, team_id: team, auth_token: "t".repeat(43), google_object_id: google ? `3388.${uuid(n)}` : null, updated_at: "2026-10-01T00:00:00.000Z" });
async function setup() {
  const store = memoryWalletStore();
  await store.createPass(pass(1, "1", "a", true));   // in roster, Google + Apple
  await store.createPass(pass(2, "2", "a", false));  // in roster, Apple only
  await store.createPass(pass(3, "9", "a", true));   // left the roster
  await store.createPass(pass(4, "1", "b", true));   // same player, other team
  await store.addDevice({ device_id: "d1", serial: uuid(1), push_token: "aa" });
  await store.addDevice({ device_id: "d2", serial: uuid(2), push_token: "bb" });
  await store.addDevice({ device_id: "d3", serial: uuid(3), push_token: "cc" });
  await store.addDevice({ device_id: "d4", serial: uuid(4), push_token: "dd" });
  return store;
}

test("avisa solo a las tarjetas del equipo que siguen en la plantilla", async () => {
  const store = await setup();
  const googleCalls: { serial: string; body: string | undefined }[] = []; const pushed: string[][] = [];
  const channels: NotifyChannels = {
    google: async (p, _card, notice) => { googleCalls.push({ serial: p.serial, body: notice?.body }); return "ok"; },
    apple: async tokens => { pushed.push(tokens); return new Map<string, PushOutcome>(tokens.map(t => [t, t === "bb" ? "unregistered" : "ok"])); },
  };
  const now = new Date("2026-10-11T12:00:00.000Z");
  const summary = await notifyTeam({ store, ctx, kind: "lineup", channels, now });
  assert.deepEqual(summary, { total: 3, withoutPass: 1, apple: { enabled: true, ok: 1, failed: 0 }, google: { enabled: true, ok: 1, failed: 0, rateLimited: 0 } });
  assert.deepEqual(googleCalls, [{ serial: uuid(1), body: "Convocado J5 · Pareja 1 con Dos" }]);
  assert.deepEqual(pushed, [["aa", "bb"]]);
  assert.deepEqual(store.devices.map(d => d.push_token), ["aa", "cc", "dd"]);
  assert.deepEqual(store.passes.map(p => p.updated_at), [now.toISOString(), now.toISOString(), "2026-10-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z"]);
});
test("errores, límite de Google, tarjeta no guardada y canales desactivados", async () => {
  const store = await setup();
  const outcomes = ["rateLimited", "missing"] as const; let i = 0;
  const google: NotifyChannels["google"] = async () => outcomes[i++ % 2];
  const summary = await notifyTeam({ store, ctx, kind: "result", channels: { google, apple: async tokens => new Map<string, PushOutcome>(tokens.map(t => [t, "failed"])) }, now: new Date() });
  assert.deepEqual(summary.google, { enabled: true, ok: 0, failed: 0, rateLimited: 1 });
  assert.deepEqual(summary.apple, { enabled: true, ok: 0, failed: 2 });
  const off = await notifyTeam({ store: await setup(), ctx, kind: "lineup", channels: { google: null, apple: null }, now: new Date() });
  assert.deepEqual(off, { total: 3, withoutPass: 1, apple: { enabled: false, ok: 0, failed: 0 }, google: { enabled: false, ok: 0, failed: 0, rateLimited: 0 } });
});
```

- [ ] **Step 2: Comprobar que falla**

Run: `pnpm exec tsx --test tests/wallet-notify.test.ts`
Expected: FAIL, `Cannot find module`.

- [ ] **Step 3: Implementar**

`src/domain/wallet-ui.ts`:

```ts
export type NotifySummary = { total: number; withoutPass: number; apple: { enabled: boolean; ok: number; failed: number }; google: { enabled: boolean; ok: number; failed: number; rateLimited: number } };
```

`src/lib/wallet-notify.ts`:

```ts
import { buildWalletCard, walletNotice, type NotifyKind, type TeamCardContext, type WalletCardData } from "@/domain/wallet-card";
import type { NotifySummary } from "@/domain/wallet-ui";
import type { PushOutcome } from "./wallet-apns";
import type { GoogleOutcome } from "./wallet-google";
import type { WalletPass, WalletStore } from "./wallet-store";
export type NotifyChannels = {
  apple: ((tokens: string[]) => Promise<Map<string, PushOutcome>>) | null;
  google: ((pass: WalletPass, card: WalletCardData, notice: { header: string; body: string } | null) => Promise<GoogleOutcome>) | null;
};
// One failed pass or device never stops the rest; the summary tells the coach what happened.
export async function notifyTeam({ store, ctx, kind, channels, now }: { store: WalletStore; ctx: TeamCardContext; kind: NotifyKind; channels: NotifyChannels; now: Date }): Promise<NotifySummary> {
  const cards = new Map<string, WalletCardData>();
  for (const player of ctx.players) { const card = buildWalletCard(ctx, player.sourceId); if (card) cards.set(player.sourceId, card); }
  const passes = (await store.teamPasses(ctx.teamId)).filter(p => cards.has(p.player_id));
  const summary: NotifySummary = {
    total: ctx.players.length, withoutPass: ctx.players.filter(pl => !passes.some(p => p.player_id === pl.sourceId)).length,
    apple: { enabled: channels.apple !== null, ok: 0, failed: 0 }, google: { enabled: channels.google !== null, ok: 0, failed: 0, rateLimited: 0 },
  };
  if (channels.google) {
    const send = channels.google;
    const outcomes = await Promise.all(passes.filter(p => p.google_object_id).map(p => { const card = cards.get(p.player_id)!; return send(p, card, walletNotice(ctx, card, kind)); }));
    for (const outcome of outcomes) { if (outcome === "ok") summary.google.ok++; else if (outcome === "rateLimited") summary.google.rateLimited++; else if (outcome === "failed") summary.google.failed++; }
  }
  if (channels.apple && passes.length) {
    const serials = passes.map(p => p.serial);
    await store.touchPasses(serials, now.toISOString());
    const devices = await store.devicesFor(serials);
    const outcomes = devices.length ? await channels.apple(devices.map(d => d.push_token)) : new Map<string, PushOutcome>();
    for (const [token, outcome] of outcomes) {
      if (outcome === "ok") summary.apple.ok++;
      else if (outcome === "failed") summary.apple.failed++;
      else await store.removePushToken(token);
    }
  }
  return summary;
}
```

- [ ] **Step 4: Comprobar que pasa**

Run: `pnpm exec tsx --test tests/wallet-notify.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verificar y hacer commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`

```bash
git add src/domain/wallet-ui.ts src/lib/wallet-notify.ts tests/wallet-notify.test.ts
git commit -m "feat: aviso al equipo en Apple y Google Wallet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Publicar convocatoria y ruta de aviso

**Files:**
- Create: `src/lib/wallet-notify-service.ts`
- Create: `src/app/api/wallet/notify/route.ts`
- Test: `tests/wallet-notify-api.test.ts`

**Interfaces:**
- Consumes: `loadTeamContext` (Task 9), `notifyTeam`, `NotifyChannels` (Task 10), `walletStore` (Task 4), `lineups` (`src/lib/saved-lineups.ts`), `sortPairs` (`src/domain/rules.ts`), `shareableTeams` (`src/lib/team-captains.ts`), `appleConfig`, `googleConfig`, `publicBaseUrl` (Task 1), `withApns`, `pushToDevices` (Task 6), `googleWalletClient`, `googleObject` (Task 7)
- Produces:
  - `requireNotifier(teamId: TeamId): Promise<void>`: lanza `AccountError(…, 401 | 403)` si el usuario no es el entrenador ni el capitán de ese equipo.
  - `notifyOptions(teamId: TeamId): Promise<{ nextFixtureId: string | null; lastFixtureId: string | null; lineups: { id: string; name: string }[]; publishedLineupId: string | null }>`
  - `publishAndNotify(input: { teamId: TeamId; kind: NotifyKind; fixtureId: string; lineupId?: string }, now?: Date): Promise<NotifySummary>`
  - `GET /api/wallet/notify?teamId=a` → `notifyOptions`; `POST /api/wallet/notify` → `{ summary }`

- [ ] **Step 1: Escribir el test que falla**

`tests/wallet-notify-api.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../src/app/api/wallet/notify/route";

const post = (origin: string, body: string) => new Request("http://localhost/api/wallet/notify", { method: "POST", headers: { origin, host: "localhost", "Content-Type": "application/json" }, body });

test("la API de avisos rechaza otro origen, cuerpos grandes y datos no válidos antes de leer la sesión", async () => {
  assert.equal((await POST(post("http://example.com", JSON.stringify({ teamId: "a", kind: "result", fixtureId: "40" })))).status, 403);
  assert.equal((await POST(post("http://localhost", "x".repeat(6000)))).status, 413);
  assert.equal((await POST(post("http://localhost", JSON.stringify({ teamId: "c", kind: "result", fixtureId: "40" })))).status, 400);
  assert.equal((await POST(post("http://localhost", JSON.stringify({ teamId: "a", kind: "lineup", fixtureId: "50", lineupId: "no-uuid" })))).status, 400);
  assert.equal((await POST(post("http://localhost", JSON.stringify({ teamId: "a", kind: "otro", fixtureId: "50" })))).status, 400);
  assert.equal((await GET(new Request("http://localhost/api/wallet/notify?teamId=z"))).status, 400);
});
```

- [ ] **Step 2: Comprobar que falla**

Run: `pnpm exec tsx --test tests/wallet-notify-api.test.ts`
Expected: FAIL, `Cannot find module`.

- [ ] **Step 3: Implementar el servicio**

`src/lib/wallet-notify-service.ts`:

```ts
import { sortPairs } from "@/domain/rules";
import type { NotifyKind } from "@/domain/wallet-card";
import type { NotifySummary } from "@/domain/wallet-ui";
import type { TeamId } from "@/domain/types";
import { AccountError, currentAccount } from "./account-auth";
import { lineups } from "./saved-lineups";
import { shareableTeams } from "./team-captains";
import { pushToDevices, withApns } from "./wallet-apns";
import { appleConfig, googleConfig, publicBaseUrl } from "./wallet-config";
import { googleObject, googleWalletClient } from "./wallet-google";
import { loadTeamContext } from "./wallet-issue";
import { notifyTeam, type NotifyChannels } from "./wallet-notify";
import { walletStore } from "./wallet-store";
// Same rule as the WhatsApp message: the coach always, a player only as captain of that team.
export async function requireNotifier(teamId: TeamId) {
  const user = await currentAccount(); if (!user) throw new AccountError("Inicia sesión para acceder a la web.", 401);
  if (!(await shareableTeams(user)).includes(teamId)) throw new AccountError("Solo el entrenador o el capitán pueden avisar al equipo.", 403);
}
export async function notifyOptions(teamId: TeamId) {
  const store = walletStore();
  const [ctx, saved] = await Promise.all([loadTeamContext(teamId, store), lineups(teamId, "list")]);
  const published = ctx.next ? await store.publishedLineup(teamId, ctx.next.id) : null;
  return { nextFixtureId: ctx.next?.id ?? null, lastFixtureId: ctx.last?.fixtureId ?? null, lineups: saved.map(l => ({ id: l.id, name: l.name })), publishedLineupId: published?.lineup_id ?? null };
}
export async function publishAndNotify({ teamId, kind, fixtureId, lineupId }: { teamId: TeamId; kind: NotifyKind; fixtureId: string; lineupId?: string }, now = new Date()): Promise<NotifySummary> {
  const apple = appleConfig(); const google = googleConfig(); const baseUrl = publicBaseUrl();
  if (!apple && !google) throw new AccountError("Wallet aún no está configurado.", 503);
  const store = walletStore();
  let ctx = await loadTeamContext(teamId, store, now.getTime());
  if (kind === "lineup") {
    if (ctx.next?.id !== fixtureId) throw new AccountError("Solo se puede publicar la convocatoria del próximo partido.", 409);
    const saved = (await lineups(teamId, "list")).find(l => l.id === lineupId);
    if (!saved) throw new AccountError("No se encuentra esa alineación.", 404);
    // Frozen in the same order "Preparar parejas" shows, so the pair number never shifts later.
    const pairs = sortPairs(saved.pairs, ctx.players);
    await store.publishLineup({ team_id: teamId, fixture_id: fixtureId, lineup_id: saved.id, pairs, published_at: now.toISOString() });
    ctx = { ...ctx, published: { fixtureId, pairs } };
  } else if (ctx.last?.fixtureId !== fixtureId) throw new AccountError("Solo se puede avisar del resultado de la última jornada.", 409);
  const client = google && baseUrl ? googleWalletClient(google) : null;
  const channels: NotifyChannels = {
    google: client && google && baseUrl ? (pass, card, notice) => client.update(pass.google_object_id!, googleObject(card, { issuerId: google.issuerId, serial: pass.serial, baseUrl }), notice, `${kind}-${fixtureId}-${now.getTime()}`) : null,
    apple: apple ? tokens => withApns(apple, send => pushToDevices(tokens, send)) : null,
  };
  return notifyTeam({ store, ctx, kind, channels, now });
}
```

- [ ] **Step 4: Implementar la ruta**

`src/app/api/wallet/notify/route.ts`:

```ts
import { accountBody, accountFailure, accountReply, AccountError } from "@/lib/account-auth";
import { notifyOptions, publishAndNotify, requireNotifier } from "@/lib/wallet-notify-service";
import type { TeamId } from "@/domain/types";
export const runtime = "nodejs";
const isTeam = (value: unknown): value is TeamId => value === "a" || value === "b";
export async function GET(request: Request) {
  try {
    const teamId = new URL(request.url).searchParams.get("teamId");
    if (!isTeam(teamId)) throw new AccountError("Equipo no válido.");
    await requireNotifier(teamId);
    return accountReply(await notifyOptions(teamId));
  } catch (error) { return accountFailure(error); }
}
export async function POST(request: Request) {
  try {
    const body = await accountBody(request);
    const { teamId, kind, fixtureId, lineupId } = body;
    if (!isTeam(teamId) || (kind !== "lineup" && kind !== "result") || typeof fixtureId !== "string" || !/^\d{1,10}$/.test(fixtureId)) throw new AccountError("Petición no válida.");
    if (kind === "lineup" && (typeof lineupId !== "string" || !/^[a-f0-9-]{36}$/.test(lineupId))) throw new AccountError("Elige una alineación guardada.");
    await requireNotifier(teamId);
    return accountReply({ summary: await publishAndNotify({ teamId, kind, fixtureId, ...(kind === "lineup" ? { lineupId: lineupId as string } : {}) }) });
  } catch (error) { return accountFailure(error); }
}
```

- [ ] **Step 5: Comprobar que pasa**

Run: `pnpm exec tsx --test tests/wallet-notify-api.test.ts`
Expected: PASS. Las seis comprobaciones fallan antes de leer la sesión, así que el test no necesita cookies.

- [ ] **Step 6: Verificar y hacer commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`

```bash
git add src/lib/wallet-notify-service.ts src/app/api/wallet/notify tests/wallet-notify-api.test.ts
git commit -m "feat: publicar convocatoria y avisar al equipo desde la API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Interfaz (perfil y jornada)

**Files:**
- Modify: `src/domain/wallet-ui.ts` (añadir `walletPlatforms` y `notifySummaryText`)
- Create: `src/components/wallet-buttons.tsx`
- Create: `src/components/wallet-notify.tsx`
- Modify: `src/components/account-profile.tsx` (importar y colocar `<WalletButtons/>`)
- Modify: `src/app/equipos/[teamId]/jornadas/[fixtureId]/page.tsx` (panel de aviso)
- Modify: `src/app/globals.css` (al final)
- Test: `tests/wallet-ui.test.ts`

**Interfaces:**
- Consumes: `NotifySummary` (Task 10), `GET /api/wallet` (Task 9), `GET/POST /api/wallet/notify` (Task 11), `walletAvailability` (Task 1), `lastPlayedFixture`
- Produces:
  - `type WalletPlatform = "apple" | "google"`
  - `walletPlatforms(userAgent: string, available: { apple: boolean; google: boolean }): WalletPlatform[]`. iPhone/iPad → solo Apple; Android → solo Google; resto → ambas. Siempre filtrado por las plataformas disponibles.
  - `notifySummaryText(summary: NotifySummary): string`

- [ ] **Step 1: Escribir el test que falla**

`tests/wallet-ui.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { notifySummaryText, walletPlatforms } from "../src/domain/wallet-ui";

const both = { apple: true, google: true };
test("plataformas según el dispositivo y la configuración", () => {
  assert.deepEqual(walletPlatforms("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", both), ["apple"]);
  assert.deepEqual(walletPlatforms("Mozilla/5.0 (Linux; Android 15; Pixel 9)", both), ["google"]);
  assert.deepEqual(walletPlatforms("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", both), ["apple", "google"]);
  assert.deepEqual(walletPlatforms("Mozilla/5.0 (iPhone)", { apple: false, google: true }), []);
  assert.deepEqual(walletPlatforms("Mozilla/5.0 (Windows NT 10.0)", { apple: false, google: true }), ["google"]);
});
test("resumen del aviso para el entrenador", () => {
  assert.equal(notifySummaryText({ total: 16, withoutPass: 2, apple: { enabled: true, ok: 9, failed: 0 }, google: { enabled: true, ok: 4, failed: 1, rateLimited: 1 } }),
    "14 de 16 jugadores tienen la tarjeta. Apple: 9 dispositivos avisados. Google: 4 avisados, 1 sin aviso por el límite de Google, 1 con error.");
  assert.equal(notifySummaryText({ total: 16, withoutPass: 16, apple: { enabled: true, ok: 0, failed: 0 }, google: { enabled: false, ok: 0, failed: 0, rateLimited: 0 } }),
    "Nadie ha añadido todavía la tarjeta.");
  assert.equal(notifySummaryText({ total: 3, withoutPass: 0, apple: { enabled: true, ok: 2, failed: 1 }, google: { enabled: false, ok: 0, failed: 0, rateLimited: 0 } }),
    "3 de 3 jugadores tienen la tarjeta. Apple: 2 dispositivos avisados, 1 con error.");
});
```

- [ ] **Step 2: Comprobar que falla**

Run: `pnpm exec tsx --test tests/wallet-ui.test.ts`
Expected: FAIL, `walletPlatforms is not a function` (o error de import).

- [ ] **Step 3: Implementar las funciones puras**

Añadir a `src/domain/wallet-ui.ts` (debajo del tipo `NotifySummary`):

```ts
export type WalletPlatform = "apple" | "google";
export function walletPlatforms(userAgent: string, available: { apple: boolean; google: boolean }): WalletPlatform[] {
  const wanted: WalletPlatform[] = /iPhone|iPad|iPod/.test(userAgent) ? ["apple"] : /Android/.test(userAgent) ? ["google"] : ["apple", "google"];
  return wanted.filter(platform => available[platform]);
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export function notifySummaryText(s: NotifySummary): string {
  const withPass = s.total - s.withoutPass;
  if (withPass === 0) return "Nadie ha añadido todavía la tarjeta.";
  const parts = [`${withPass} de ${s.total} jugadores tienen la tarjeta.`];
  if (s.apple.enabled) parts.push(`Apple: ${[plural(s.apple.ok, "dispositivo avisado", "dispositivos avisados"), ...(s.apple.failed ? [`${s.apple.failed} con error`] : [])].join(", ")}.`);
  if (s.google.enabled) parts.push(`Google: ${[`${s.google.ok} ${s.google.ok === 1 ? "avisado" : "avisados"}`, ...(s.google.rateLimited ? [`${s.google.rateLimited} sin aviso por el límite de Google`] : []), ...(s.google.failed ? [`${s.google.failed} con error`] : [])].join(", ")}.`);
  return parts.join(" ");
}
```

- [ ] **Step 4: Comprobar que pasa**

Run: `pnpm exec tsx --test tests/wallet-ui.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Componente de botones**

`src/components/wallet-buttons.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { walletPlatforms, type WalletPlatform } from "@/domain/wallet-ui";
import type { TeamId } from "@/domain/types";
type WalletState = { apple: boolean; google: boolean; teams: TeamId[] };
// Hidden until the platform credentials exist and the player is on a roster.
export function WalletButtons() {
  const [state, setState] = useState<{ teams: TeamId[]; platforms: WalletPlatform[] } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/wallet", { signal: controller.signal, cache: "no-store" }).then(r => r.ok ? r.json() : null).then((data: WalletState | null) => { if (data) setState({ teams: data.teams, platforms: walletPlatforms(navigator.userAgent, data) }); }).catch(() => {});
    return () => controller.abort();
  }, []);
  if (!state || !state.teams.length || !state.platforms.length) return null;
  return <section className="panel wallet-panel">
    <div className="panel-heading"><h2><Wallet size={18} aria-hidden/> Tarjeta del equipo</h2></div>
    <p className="data-note">Añádela a tu móvil: verás el próximo partido, tu convocatoria, el último resultado y tus puntos SNP, y te avisará cuando el entrenador publique novedades.</p>
    <div className="wallet-buttons">{state.teams.flatMap(teamId => state.platforms.map(platform => <a key={`${teamId}-${platform}`} className="button secondary" href={`/api/wallet/${platform}?team=${teamId}`}>{platform === "apple" ? "Añadir a Apple Wallet" : "Guardar en Google Wallet"}{state.teams.length > 1 ? ` · Equipo ${teamId.toUpperCase()}` : ""}</a>))}</div>
  </section>;
}
```

En `src/components/account-profile.tsx`, añadir el import junto a los demás componentes:

```tsx
import { WalletButtons } from "./wallet-buttons";
```

y colocar `<WalletButtons/>` justo antes de `<div className="section-title"><h2>Cuenta y posición</h2></div>`.

- [ ] **Step 6: Componente de aviso**

`src/components/wallet-notify.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { notifySummaryText } from "@/domain/wallet-ui";
import type { TeamId } from "@/domain/types";
type Options = { lineups: { id: string; name: string }[]; publishedLineupId: string | null };
// Coach or captain: publish the next fixture's lineup or announce the last result in Wallet.
export function WalletNotify({ teamId, fixtureId, kind }: { teamId: TeamId; fixtureId: string; kind: "lineup" | "result" }) {
  const [options, setOptions] = useState<Options | null>(null); const [lineupId, setLineupId] = useState("");
  const [busy, setBusy] = useState(false); const [status, setStatus] = useState(""); const [error, setError] = useState("");
  useEffect(() => {
    if (kind !== "lineup") return;
    const controller = new AbortController();
    void fetch(`/api/wallet/notify?teamId=${teamId}`, { signal: controller.signal, cache: "no-store" })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setOptions(data); setLineupId(data.publishedLineupId ?? data.lineups[0]?.id ?? ""); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "No se pudieron cargar las alineaciones."); });
    return () => controller.abort();
  }, [kind, teamId]);
  async function send() {
    if (!window.confirm(kind === "lineup" ? "¿Publicar esta convocatoria y avisar al equipo en Wallet?" : "¿Avisar al equipo del resultado en Wallet?")) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const response = await fetch("/api/wallet/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId, kind, fixtureId, ...(kind === "lineup" ? { lineupId } : {}) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setStatus(notifySummaryText(data.summary));
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo avisar al equipo."); }
    finally { setBusy(false); }
  }
  return <section className="panel wallet-panel">
    <div className="panel-heading"><h2><BellRing size={18} aria-hidden/> Avisar en Wallet</h2></div>
    {kind === "lineup" && options?.lineups.length === 0 && <p className="data-note">Guarda primero una alineación en «Preparar parejas».</p>}
    {kind === "lineup" && !!options?.lineups.length && <label className="wallet-field">Alineación<select value={lineupId} onChange={e => setLineupId(e.target.value)}>{options.lineups.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
    <button type="button" className="button" disabled={busy || (kind === "lineup" && !lineupId)} onClick={() => void send()}>{busy ? "Avisando…" : kind === "lineup" ? "Publicar convocatoria y notificar" : "Notificar resultado"}</button>
    {status && <p className="account-message" role="status">{status}</p>}
    {error && <p className="snp-warning" role="alert">{error}</p>}
  </section>;
}
```

- [ ] **Step 7: Panel en la página de la jornada**

En `src/app/equipos/[teamId]/jornadas/[fixtureId]/page.tsx`, añadir los imports:

```tsx
import { WalletNotify } from "@/components/wallet-notify";
import { walletAvailability } from "@/lib/wallet-config";
import { lastPlayedFixture } from "@/domain/pending-results";
```

Después de la línea `const card=share&&<TeamResultCard message={share}/>;` añadir (va detrás de `currentAccount()`, así que la página ya es dinámica y se puede usar `Date.now()`):

```tsx
  // Lineup on the next fixture, result on the last played one; only for the coach and the captain.
  const available=walletAvailability();
  const walletKind=teams.includes(teamId)&&(available.apple||available.google)?(fixtures.find(f=>f.status==="pending")?.id===fixtureId?"lineup":lastPlayedFixture(fixtures,Date.now())?.id===fixtureId?"result":null):null;
  const wallet=walletKind&&<WalletNotify teamId={teamId} fixtureId={fixtureId} kind={walletKind}/>;
```

y en los dos `return`, sustituir `{card}</MatchdaySlide>` por `{card}{wallet}</MatchdaySlide>`.

- [ ] **Step 8: Estilos**

Añadir al final de `src/app/globals.css`:

```css
.wallet-panel h2 { display: flex; align-items: center; gap: 0.5rem; }
.wallet-buttons { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.75rem; }
.wallet-field { display: grid; gap: 0.35rem; margin-bottom: 0.75rem; }
```

- [ ] **Step 9: Verificar el build y las rutas**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: todo en verde. En la salida de `next build` aparecen `/api/wallet`, `/api/wallet/apple`, `/api/wallet/google`, `/api/wallet/notify` y las rutas `/api/wallet/apple/v1/...`.

Comprobación manual sin credenciales de Wallet: `pnpm dev`, inicia sesión como jugador en `/mi-perfil`. **No** debe aparecer el bloque «Tarjeta del equipo», porque Wallet no está configurado. Como entrenador, en la jornada siguiente **no** debe aparecer «Avisar en Wallet». Con credenciales configuradas en `.env.local`, ambos bloques deben aparecer.

- [ ] **Step 10: Commit**

```bash
git add src/domain/wallet-ui.ts src/components/wallet-buttons.tsx src/components/wallet-notify.tsx src/components/account-profile.tsx "src/app/equipos/[teamId]/jornadas/[fixtureId]/page.tsx" src/app/globals.css tests/wallet-ui.test.ts
git commit -m "feat: botones de Wallet en el perfil y aviso al equipo en la jornada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Documentación para el owner y verificación final

**Files:**
- Create: `docs/wallet.md`
- Modify: `README.md` (una línea en la sección inicial)

- [ ] **Step 1: Guía de puesta en marcha**

`docs/wallet.md`:

````markdown
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
````

En `README.md`, después del párrafo que enlaza `docs/integracion-snp.md`, añadir:

```markdown
Tarjetas de Apple Wallet y Google Wallet con avisos al equipo: [puesta en marcha](docs/wallet.md).
```

- [ ] **Step 2: Verificación completa (como en CI)**

Run: `node scripts/check-repository.mjs && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: `findings: []`, sin errores de lint ni de tipos, todos los tests en verde y build correcto.

- [ ] **Step 3: Comprobación de rutas con el servidor**

Run: `pnpm start &` y después `node scripts/check-routes.mjs`
Expected: las rutas existentes siguen respondiendo igual que antes.

- [ ] **Step 4: Commit**

```bash
git add docs/wallet.md README.md
git commit -m "docs: puesta en marcha de las tarjetas Wallet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

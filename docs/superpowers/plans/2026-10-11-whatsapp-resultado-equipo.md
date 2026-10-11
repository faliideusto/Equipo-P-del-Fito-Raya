# Resultado del equipo para WhatsApp — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando las 5 parejas de una jornada tienen resultado, el capitán o el entrenador ven el mensaje del equipo con la plantilla del club y lo envían al grupo de WhatsApp con un toque (`wa.me`).

**Architecture:** La plantilla y el cálculo van en una función pura de dominio (`src/domain/team-result-message.ts`). Los capitanes se guardan en la tabla `team_captains`, con el mismo patrón REST/archivo que `mvp.ts`, y los permisos se resuelven con una función pura (`src/domain/team-captain.ts`). Un servicio en el servidor junta los resultados de la app, el acta SNP y la plantilla. La interfaz son una tarjeta en la vista de la jornada, un chip flotante y una sección en `/entrenador`.

**Tech Stack:** Next.js (App Router, versión del repo), React, TypeScript, Supabase REST, `node:test` con `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-11-whatsapp-resultado-equipo-design.md`

## Global Constraints

- La app nunca envía a WhatsApp. Solo hay un enlace `https://wa.me/?text=<encodeURIComponent(texto)>` y el botón «Copiar».
- Pueden compartir el entrenador (`role: "coach"`) y el capitán del equipo. Visitantes, jugadores sin ficha y el resto → sin permiso.
- `DEV_CAPTAIN_PLAYER_ID` solo vale si `NODE_ENV !== "production"`, `RENDER !== "true"` y `VERCEL !== "1"`, y solo para equipos en cuya plantilla está ese jugador.
- Completa = las 5 parejas con resultado de la app o con sets SNP. Si hay ambos, manda la app.
- Sets de la app: `[nosotros, rivales]`. Sets SNP: `[local, visitante]` → `toActaSets(sets, ownSide)` los convierte en los dos sentidos.
- Valores de pareja: `MATCH_VALUES = [3, 3, 2, 2, 2]`.
- Texto sin la línea de «resultado provisional». Termina en `💪 ¡Vamos Fito Raya!`.
- Tabla `team_captains` solo para `service_role`. Si falta la tabla, la app no se rompe.
- Textos de la interfaz en español. El código sigue el estilo compacto del repo.

## Review Focus

- Jugamos de visitante y los sets vienen de SNP: el ✅/❌ y el marcador deben salir desde nuestro lado → test en Task 1.
- Una pareja ganada con súper tie-break (6-4 · 3-6 · 10-8) cuenta como victoria → test en Task 1.
- Empate 6–6 → `🤝 *EMPATE 6–6*` → test en Task 1.
- Fecha sin hora (`2026-10-18`) → la línea 📅 no muestra hora → test en Task 1.
- `DEV_CAPTAIN_PLAYER_ID` con `RENDER=true` no da permiso → test en Task 2.

---

### Task 1: Mensaje del resultado (dominio puro)

**Files:**
- Create: `src/domain/team-result-message.ts`
- Test: `tests/team-result-message.test.ts`

**Interfaces:**
- Produces:
  - `type TeamResultPair = { index: number; sets: SetScore[]; names: string[] }`
  - `teamResultPairs({ appResults, acta, ownSide, submitterNames }: { appResults: Record<number, SetScore[]>; acta: SnpMatch | null; ownSide: 0 | 1; submitterNames: Record<number, string> }): TeamResultPair[] | null`
  - `buildTeamResultMessage({ round, teamId, opponent, home, date, pairs }: { round: number; teamId: TeamId; opponent: string; home: boolean; date: string; pairs: TeamResultPair[] }): string`
  - `whatsappShareUrl(text: string): string`

- [ ] **Step 1: Write the failing test** — `tests/team-result-message.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildTeamResultMessage, teamResultPairs, whatsappShareUrl, type TeamResultPair } from "../src/domain/team-result-message";
import type { SnpMatch } from "../src/domain/snp";
import type { SetScore } from "../src/domain/match-result";

const p = (id: string) => ({ id, name: `Jugador ${id}`, photoUrl: null });
const acta = (games: { home: string[]; away: string[]; sets?: SetScore[] }[]): SnpMatch => ({ id: "1", title: "", dateLabel: "", teams: ["Fito A", "Arcos"], teamIds: ["7778", "3349"], score: null, games: games.map((g, index) => ({ index, homePlayers: g.home.map(id => `Jugador ${id}`), awayPlayers: g.away.map(id => `Jugador ${id}`), home: g.home.map(p), away: g.away.map(p), sets: g.sets ?? [] })) });
const win: SetScore[] = [[6, 3], [6, 4]]; const loss: SetScore[] = [[4, 6], [6, 7]];
const pair = (index: number, sets: SetScore[], names = [`A${index}`, `B${index}`]): TeamResultPair => ({ index, sets, names });

test("sin las cinco parejas no hay mensaje", () => {
  assert.equal(teamResultPairs({ appResults: { 1: win, 2: win, 3: win, 4: win }, acta: null, ownSide: 0, submitterNames: {} }), null);
});
test("combina app y SNP; la app manda y los sets SNP se giran si somos visitantes", () => {
  const match = acta([1, 2, 3, 4, 5].map(i => ({ home: [`r${i}`, `s${i}`], away: [`${i}0`, `${i}1`], sets: i === 5 ? [[3, 6], [4, 6]] : [] })));
  const pairs = teamResultPairs({ appResults: { 1: win, 2: loss, 3: win, 4: loss }, acta: match, ownSide: 1, submitterNames: {} })!;
  assert.deepEqual(pairs[4].sets, [[6, 3], [6, 4]]);
  assert.deepEqual(pairs[0].names, ["Jugador 10", "Jugador 11"]);
  const appWins = teamResultPairs({ appResults: { 1: win, 2: win, 3: win, 4: win, 5: loss }, acta: match, ownSide: 1, submitterNames: {} })!;
  assert.deepEqual(appWins[4].sets, loss);
});
test("sin convocatoria usa el nombre de quien envió el resultado", () => {
  const pairs = teamResultPairs({ appResults: { 1: win, 2: win, 3: win, 4: win, 5: win }, acta: null, ownSide: 0, submitterNames: { 2: "Dani Ruiz" } })!;
  assert.deepEqual(pairs[1].names, ["Dani Ruiz"]);
  assert.deepEqual(pairs[0].names, []);
});
test("plantilla completa con victoria, tercer set y súper tie-break", () => {
  const text = buildTeamResultMessage({ round: 4, teamId: "a", opponent: "C.D. VibraPadel", home: true, date: "2026-10-18T15:00:00.000Z", pairs: [pair(1, win), pair(2, loss), pair(3, [[6, 4], [3, 6], [10, 8]]), pair(4, loss), pair(5, win, [])] });
  assert.equal(text, [
    "🎾 *Jornada 4 · Fito Raya A*", "🆚 C.D. VibraPadel · 🏠 Local", "📅 Dom 18/10 · 17:00", "",
    "🏆 *¡VICTORIA 7–5!*", "",
    "*Pareja 1* (3 pts) ✅", "A1 / B1", "6-3 · 6-4", "",
    "*Pareja 2* (3 pts) ❌", "A2 / B2", "4-6 · 6-7", "",
    "*Pareja 3* (2 pts) ✅", "A3 / B3", "6-4 · 3-6 · 10-8", "",
    "*Pareja 4* (2 pts) ❌", "A4 / B4", "4-6 · 6-7", "",
    "*Pareja 5* (2 pts) ✅", "6-3 · 6-4", "",
    "💪 ¡Vamos Fito Raya!",
  ].join("\n"));
});
test("derrota de visitante con fecha sin hora", () => {
  const text = buildTeamResultMessage({ round: 2, teamId: "b", opponent: "Arcos", home: false, date: "2026-10-18", pairs: [pair(1, loss), pair(2, loss), pair(3, win), pair(4, win), pair(5, loss)] });
  assert.match(text, /^🎾 \*Jornada 2 · Fito Raya B\*\n🆚 Arcos · ✈️ Visitante\n📅 Dom 18\/10\n\n/);
  assert.match(text, /😔 \*DERROTA 4–8\*/);
});
test("empate 6–6 y fecha vacía sin línea de fecha", () => {
  const text = buildTeamResultMessage({ round: 1, teamId: "a", opponent: "X", home: true, date: "", pairs: [pair(1, win), pair(2, win), pair(3, loss), pair(4, loss), pair(5, loss)] });
  assert.match(text, /🤝 \*EMPATE 6–6\*/);
  assert.ok(!text.includes("📅"));
});
test("enlace de WhatsApp codificado", () => {
  assert.equal(whatsappShareUrl("¡Hola *equipo*!\n6-3"), "https://wa.me/?text=%C2%A1Hola%20*equipo*!%0A6-3");
});
```

- [ ] **Step 2:** `pnpm exec tsx --test tests/team-result-message.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3: Implementación** — `src/domain/team-result-message.ts`:

```ts
import type { SnpMatch } from "./snp";
import type { TeamId } from "./types";
import type { SetScore } from "./match-result";
import { MATCH_VALUES } from "./rules";
import { toActaSets } from "./result-edit";
export type TeamResultPair = { index: number; sets: SetScore[]; names: string[] };
// The five pairs from our side: app results first, otherwise sets published by SNP.
export function teamResultPairs({ appResults, acta, ownSide, submitterNames }: { appResults: Record<number, SetScore[]>; acta: SnpMatch | null; ownSide: 0 | 1; submitterNames: Record<number, string> }): TeamResultPair[] | null {
  const pairs: TeamResultPair[] = [];
  for (let index = 1; index <= MATCH_VALUES.length; index++) {
    const game = acta?.games.find(g => g.index === index - 1);
    const sets = appResults[index] ?? (game?.sets.length ? toActaSets(game.sets, ownSide) : null);
    if (!sets) return null;
    const lineup = game ? (ownSide === 0 ? game.home?.map(p => p.name) ?? game.homePlayers : game.away?.map(p => p.name) ?? game.awayPlayers).filter(Boolean) : [];
    pairs.push({ index, sets, names: lineup.length ? lineup : submitterNames[index] ? [submitterNames[index]] : [] });
  }
  return pairs;
}
const won = (sets: SetScore[]) => sets.filter(([a, b]) => a > b).length > sets.length / 2;
function dateLine(date: string) {
  const time = Date.parse(date); if (!date || Number.isNaN(time)) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Madrid" }).formatToParts(new Date(time)).map(p => [p.type, p.value]));
  const day = `${parts.weekday.charAt(0).toUpperCase()}${parts.weekday.slice(1).replace(".", "")} ${parts.day}/${parts.month}`;
  const hour = date.includes("T") ? new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(time)) : null;
  return `📅 ${day}${hour ? ` · ${hour}` : ""}`;
}
export function buildTeamResultMessage({ round, teamId, opponent, home, date, pairs }: { round: number; teamId: TeamId; opponent: string; home: boolean; date: string; pairs: TeamResultPair[] }) {
  let ours = 0, theirs = 0;
  for (const pair of pairs) { const value = MATCH_VALUES[pair.index - 1]; if (won(pair.sets)) ours += value; else theirs += value; }
  const score = `${ours}–${theirs}`;
  const result = ours > theirs ? `🏆 *¡VICTORIA ${score}!*` : ours < theirs ? `😔 *DERROTA ${score}*` : `🤝 *EMPATE ${score}*`;
  const header = [`🎾 *Jornada ${round} · Fito Raya ${teamId.toUpperCase()}*`, `🆚 ${opponent} · ${home ? "🏠 Local" : "✈️ Visitante"}`, dateLine(date)].filter((line): line is string => line !== null);
  const blocks = pairs.map(pair => [`*Pareja ${pair.index}* (${MATCH_VALUES[pair.index - 1]} pts) ${won(pair.sets) ? "✅" : "❌"}`, ...(pair.names.length ? [pair.names.join(" / ")] : []), pair.sets.map(s => s.join("-")).join(" · ")].join("\n"));
  return [header.join("\n"), result, ...blocks, "💪 ¡Vamos Fito Raya!"].join("\n\n");
}
export const whatsappShareUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
```

- [ ] **Step 4:** `pnpm exec tsx --test tests/team-result-message.test.ts` → PASS.
- [ ] **Step 5:** `git add src/domain/team-result-message.ts tests/team-result-message.test.ts && git commit -m "feat: mensaje del resultado del equipo para WhatsApp"`

### Task 2: Capitanes (permisos, almacén y SQL)

**Files:**
- Create: `src/domain/team-captain.ts`, `src/lib/team-captains.ts`, `supabase/team-captains.sql`
- Test: `tests/team-captains.test.ts`

**Interfaces:**
- Produces:
  - `type TeamCaptain = { team_id: TeamId; player_id: string; updated_at: string }`
  - `devCaptainId(env: Record<string, string | undefined>): string | null`
  - `isTeamCaptain({ captains, teamId, playerId, onRoster, env }: { captains: TeamCaptain[]; teamId: TeamId; playerId: string; onRoster: boolean; env: Record<string, string | undefined> }): boolean`
  - `class MissingCaptainsTable extends Error`
  - `listCaptains(): Promise<TeamCaptain[]>` (lanza `MissingCaptainsTable` si falta la tabla)
  - `setCaptain(teamId: TeamId, playerId: string | null): Promise<TeamCaptain[]>`
  - `shareableTeams(user: { id: string; role?: string } | null): Promise<TeamId[]>`

- [ ] **Step 1: Test** — `tests/team-captains.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { devCaptainId, isTeamCaptain, type TeamCaptain } from "../src/domain/team-captain";
const captains: TeamCaptain[] = [{ team_id: "a", player_id: "10", updated_at: "" }];
test("el capitán guardado solo lo es de su equipo", () => {
  assert.equal(isTeamCaptain({ captains, teamId: "a", playerId: "10", onRoster: true, env: {} }), true);
  assert.equal(isTeamCaptain({ captains, teamId: "b", playerId: "10", onRoster: true, env: {} }), false);
  assert.equal(isTeamCaptain({ captains, teamId: "a", playerId: "11", onRoster: true, env: {} }), false);
});
test("DEV_CAPTAIN_PLAYER_ID solo en desarrollo y en su plantilla", () => {
  const dev = { DEV_CAPTAIN_PLAYER_ID: " 22 ", NODE_ENV: "development" };
  assert.equal(devCaptainId(dev), "22");
  assert.equal(isTeamCaptain({ captains: [], teamId: "b", playerId: "22", onRoster: true, env: dev }), true);
  assert.equal(isTeamCaptain({ captains: [], teamId: "b", playerId: "22", onRoster: false, env: dev }), false);
  assert.equal(devCaptainId({ ...dev, NODE_ENV: "production" }), null);
  assert.equal(devCaptainId({ ...dev, RENDER: "true" }), null);
  assert.equal(devCaptainId({ ...dev, VERCEL: "1" }), null);
  assert.equal(devCaptainId({ NODE_ENV: "development" }), null);
});
```

- [ ] **Step 2:** `pnpm exec tsx --test tests/team-captains.test.ts` → FAIL.
- [ ] **Step 3: Implementación**

`src/domain/team-captain.ts`:
```ts
import type { TeamId } from "./types";
export type TeamCaptain = { team_id: TeamId; player_id: string; updated_at: string };
type Env = Record<string, string | undefined>;
// Local testing only: never honoured on Render, Vercel or a production build.
export function devCaptainId(env: Env) {
  if (env.NODE_ENV === "production" || env.RENDER === "true" || env.VERCEL === "1") return null;
  return env.DEV_CAPTAIN_PLAYER_ID?.trim() || null;
}
export function isTeamCaptain({ captains, teamId, playerId, onRoster, env }: { captains: TeamCaptain[]; teamId: TeamId; playerId: string; onRoster: boolean; env: Env }) {
  return captains.some(c => c.team_id === teamId && c.player_id === playerId) || (onRoster && devCaptainId(env) === playerId);
}
```

`supabase/team-captains.sql`:
```sql
-- One captain per club team, chosen by the coach. Only the server can read or write it.
create table if not exists public.team_captains (
  team_id text primary key check (team_id in ('a', 'b')),
  player_id text not null check (player_id ~ '^[0-9]{1,10}$'),
  updated_at timestamptz not null default now()
);
alter table public.team_captains enable row level security;
revoke all on public.team_captains from anon, authenticated;
grant select, insert, update, delete on public.team_captains to service_role;
```

`src/lib/team-captains.ts` (patrón de `mvp.ts`; archivo local sin Supabase):
```ts
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { TeamId } from "@/domain/types";
import { devCaptainId, isTeamCaptain, type TeamCaptain } from "@/domain/team-captain";
import { clubRepository } from "@/data/repository";
import { playerLink } from "./account-profile";
export class MissingCaptainsTable extends Error {}
const FILE = ".club-private/team-captains.json";
let pending: Promise<void> = Promise.resolve();
async function request(method: "GET" | "POST" | "DELETE", params: Record<string, string>, body?: object) {
  const url = process.env.SUPABASE_URL!; const key = process.env.SUPABASE_SECRET_KEY!;
  const endpoint = new URL("/rest/v1/team_captains", url);
  if (endpoint.protocol !== "https:") throw new Error("URL no válida");
  for (const [k, v] of Object.entries(params)) endpoint.searchParams.set(k, v);
  const response = await fetch(endpoint, { method, cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (response.status === 404) { const error = await response.json().catch(() => ({})); if (error.code === "PGRST205" || error.code === "42P01") throw new MissingCaptainsTable("Falta la tabla team_captains. Ejecuta supabase/team-captains.sql en Supabase."); }
  if (!response.ok) throw new Error("No se pudieron consultar los capitanes.");
  return method === "GET" ? response.json() : null;
}
function local() {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SECRET_KEY;
  if (url && key) return false;
  if (process.env.RENDER === "true" || process.env.VERCEL === "1" || url || key) throw new Error("Configura Supabase para conservar los capitanes.");
  return true;
}
async function readLocal(): Promise<TeamCaptain[]> { try { return JSON.parse(await readFile(FILE, "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; } }
export async function listCaptains(): Promise<TeamCaptain[]> {
  return local() ? readLocal() : request("GET", { select: "team_id,player_id,updated_at", order: "team_id.asc" });
}
export async function setCaptain(teamId: TeamId, playerId: string | null): Promise<TeamCaptain[]> {
  const row: TeamCaptain | null = playerId ? { team_id: teamId, player_id: playerId, updated_at: new Date().toISOString() } : null;
  if (!local()) { if (row) await request("POST", { on_conflict: "team_id" }, row); else await request("DELETE", { team_id: `eq.${teamId}` }); return listCaptains(); }
  const operation = pending.then(async () => { const rows = (await readLocal()).filter(r => r.team_id !== teamId); if (row) rows.push(row); await mkdir(".club-private", { recursive: true }); const tmp = `${FILE}.${randomUUID()}.tmp`; await writeFile(tmp, JSON.stringify(rows), { mode: 0o600 }); await rename(tmp, FILE); });
  pending = operation.catch(() => {}); await operation; return listCaptains();
}
// Teams whose result message this user may share: the coach always, a player only as captain.
export async function shareableTeams(user: { id: string; role?: string } | null): Promise<TeamId[]> {
  if (!user || user.role === "visitor") return [];
  if (user.role === "coach") return ["a", "b"];
  const link = await playerLink(user.id).catch(() => null); if (!link) return [];
  const captains = await listCaptains().catch(() => []);
  const dev = devCaptainId(process.env) === link.player_id;
  const teams = await Promise.all((["a", "b"] as TeamId[]).map(async teamId => {
    const onRoster = dev && (await clubRepository.getPlayers(teamId).catch(() => [])).some(p => p.sourceId === link.player_id);
    return isTeamCaptain({ captains, teamId, playerId: link.player_id, onRoster, env: process.env }) ? teamId : null;
  }));
  return teams.filter((t): t is TeamId => t !== null);
}
```

- [ ] **Step 4:** `pnpm exec tsx --test tests/team-captains.test.ts` y `pnpm typecheck` → PASS.
- [ ] **Step 5:** commit `feat: capitanes de equipo elegidos por el entrenador`.

### Task 3: Servicio, API de compartir, tarjeta y chip

**Files:**
- Create: `src/lib/team-result-service.ts`, `src/app/api/results/share/route.ts`, `src/components/team-result-share.tsx`
- Modify: `src/app/equipos/[teamId]/jornadas/[fixtureId]/page.tsx`, `src/components/app-shell.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: `teamResultPairs`, `buildTeamResultMessage`, `whatsappShareUrl` (Task 1); `shareableTeams` (Task 2); `listResults` (`src/lib/match-results.ts`); `getSnpMatch`; `lastPlayedFixture`; `dueForCheck`.
- Produces:
  - `type TeamResultMessage = { fixtureId: string; teamId: TeamId; round: number; text: string; url: string }`
  - `teamResultMessage(teamId: TeamId, fixture: Fixture, acta?: SnpMatch | null): Promise<TeamResultMessage | null>`
  - `shareableResults(user, now?): Promise<TeamResultMessage[]>`
  - `GET /api/results/share → { items: TeamResultMessage[] }`
  - `<TeamResultCard message={TeamResultMessage}/>`, `<TeamResultChip/>`

- [ ] **Step 1: Servicio** — `src/lib/team-result-service.ts`:

```ts
import { clubRepository, sourceTeams } from "@/data/repository";
import { lastPlayedFixture } from "@/domain/pending-results";
import { buildTeamResultMessage, teamResultPairs, whatsappShareUrl } from "@/domain/team-result-message";
import type { SnpMatch } from "@/domain/snp";
import type { Fixture, TeamId } from "@/domain/types";
import { getSnpMatch } from "./snp-service";
import { listResults } from "./match-results";
import { shareableTeams } from "./team-captains";
export type TeamResultMessage = { fixtureId: string; teamId: TeamId; round: number; text: string; url: string };
// Built on the server only: the client never supplies any data for the message.
export async function teamResultMessage(teamId: TeamId, fixture: Fixture, acta?: SnpMatch | null): Promise<TeamResultMessage | null> {
  const [rows, match, players] = await Promise.all([listResults([fixture.id]), acta !== undefined ? acta : getSnpMatch(fixture.id).then(r => r.data).catch(() => null), clubRepository.getPlayers(teamId).catch(() => [])]);
  const own = rows.filter(r => r.team_id === teamId);
  const index = match?.teamIds?.indexOf(sourceTeams[teamId]) ?? -1;
  const ownSide = (index >= 0 ? index : fixture.home ? 0 : 1) as 0 | 1;
  const submitterNames: Record<number, string> = {};
  for (const r of own) { const name = players.find(p => p.sourceId === r.player_id)?.name; if (name) submitterNames[r.pair_index] = name; }
  const pairs = teamResultPairs({ appResults: Object.fromEntries(own.map(r => [r.pair_index, r.sets])), acta: match, ownSide, submitterNames });
  if (!pairs) return null;
  const text = buildTeamResultMessage({ round: fixture.round, teamId, opponent: fixture.opponent, home: fixture.home, date: fixture.date, pairs });
  return { fixtureId: fixture.id, teamId, round: fixture.round, text, url: whatsappShareUrl(text) };
}
export async function shareableResults(user: { id: string; role?: string } | null, now = Date.now()): Promise<TeamResultMessage[]> {
  const teams = await shareableTeams(user);
  const items = await Promise.all(teams.map(async teamId => {
    const fixture = lastPlayedFixture(await clubRepository.getFixtures(teamId).catch(() => []), now);
    return fixture ? teamResultMessage(teamId, fixture).catch(() => null) : null;
  }));
  return items.filter((item): item is TeamResultMessage => item !== null);
}
```

- [ ] **Step 2: API** — `src/app/api/results/share/route.ts`:

```ts
import { accountFailure, accountReply, currentAccount } from "@/lib/account-auth";
import { shareableResults } from "@/lib/team-result-service";
export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await currentAccount();
    if (!user) return accountReply({ error: "Inicia sesión para acceder a la web." }, 401);
    return accountReply({ items: await shareableResults(user) });
  } catch (error) { return accountFailure(error); }
}
```

- [ ] **Step 3: Componentes** — `src/components/team-result-share.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { dueForCheck } from "@/domain/pending-results";
import type { TeamResultMessage } from "@/lib/team-result-service";
const DISMISSED_KEY = "fito-share-dismissed";
const keyOf = (m: TeamResultMessage) => `${m.fixtureId}:${m.teamId}`;
function dismissed(): string[] { try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"); } catch { return []; } }
function dismiss(key: string) { try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed().filter(k => k !== key), key].slice(-20))); } catch { /* Private mode: the chip may show again. */ } }
// Preview of the team message with WhatsApp share and copy; the person picks the group and sends it.
export function TeamResultCard({ message }: { message: TeamResultMessage }) {
  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(message.text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } }
  return <section id="whatsapp" className="panel team-share"><div className="results-heading"><div><h2>Mensaje para WhatsApp</h2><p>Todas las parejas tienen resultado. Envíalo al grupo del equipo.</p></div></div><pre className="team-share-text">{message.text}</pre><div className="team-share-actions"><a className="button" href={message.url} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden/>Enviar al grupo</a><button type="button" className="button secondary" onClick={() => void copy()}>{copied ? "Copiado" : "Copiar"}</button></div></section>;
}
export function TeamResultChip() {
  const pathname = usePathname();
  const [items, setItems] = useState<TeamResultMessage[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const lastCheck = useRef<number | null>(null);
  useEffect(() => { setHidden(dismissed()); }, []);
  useEffect(() => {
    if (!dueForCheck(lastCheck.current, Date.now())) return;
    const controller = new AbortController();
    void fetch("/api/results/share", { signal: controller.signal, cache: "no-store" }).then(r => r.ok ? r.json() : { items: [] }).then(data => { lastCheck.current = Date.now(); setItems(Array.isArray(data.items) ? data.items : []); }).catch(() => {});
    return () => controller.abort();
  }, [pathname]);
  const current = items.find(m => !hidden.includes(keyOf(m)));
  if (!current) return null;
  return <div className="result-chip share-chip"><Link href={`/equipos/${current.teamId}/jornadas/${current.fixtureId}#whatsapp`}><MessageCircle size={16} aria-hidden/>Resultado del equipo · J{current.round}</Link><button type="button" aria-label="Descartar aviso" onClick={() => { dismiss(keyOf(current)); setHidden([...hidden, keyOf(current)]); }}><X size={14}/></button></div>;
}
```

- [ ] **Step 4: Pila de chips** — en `app-shell.tsx` sustituir `{!access && <ResultReminder/>}` por `{!access && <div className="chip-stack"><TeamResultChip/><ResultReminder/></div>}` (importar `TeamResultChip`). En `globals.css`, `.result-chip` deja de ser `position: fixed` y la posición pasa a `.chip-stack`:

```css
.chip-stack { position: fixed; right: 20px; bottom: 20px; z-index: 40; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.result-chip { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 999px; border: 1px solid var(--accent-line); background: var(--accent); color: var(--accent-ink); font-weight: 700; box-shadow: 0 8px 24px rgba(2, 8, 14, 0.45); cursor: pointer; }
.share-chip { padding: 0 6px 0 0; }
.share-chip a { display: inline-flex; align-items: center; gap: 8px; padding: 10px 4px 10px 14px; color: inherit; text-decoration: none; }
.share-chip button { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 999px; background: transparent; color: inherit; cursor: pointer; }
.team-share { margin-top: 24px; }
.team-share-text { white-space: pre-wrap; word-break: break-word; font: inherit; font-size: 14px; line-height: 1.5; margin: 0 0 16px; padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); }
.team-share-actions { display: flex; flex-wrap: wrap; gap: 10px; }
@media (max-width: 640px) { .chip-stack { right: 16px; bottom: 16px; } }
```
(y retirar `right/bottom` de `.result-chip` en la media query existente).

- [ ] **Step 5: Vista de la jornada** — en `page.tsx`, leer el usuario una vez y, si puede compartir, generar el mensaje con el acta ya cargada:

```tsx
const [result,user]=await Promise.all([getSnpMatch(fixtureId).catch(()=>null),currentAccount().catch(()=>null)]);
const [link,teams]=await Promise.all([user&&user.role!=="coach"&&user.role!=="visitor"?playerLink(user.id).catch(()=>null):null,shareableTeams(user).catch(()=>[])]);
const share=teams.includes(teamId)?await teamResultMessage(teamId,fixture,result?.data??null).catch(()=>null):null;
const card=share&&<TeamResultCard message={share}/>;
```
y añadir `{card}` tras `<SnpMatchView …/>` y tras el panel de error. `fixtureProvisional` recibe `link?user!.id:null`.

- [ ] **Step 6:** `pnpm typecheck && pnpm lint && pnpm test` → PASS.
- [ ] **Step 7:** commit `feat: tarjeta y aviso del mensaje de WhatsApp para capitán y entrenador`.

### Task 4: Capitanes en `/entrenador`

**Files:**
- Create: `src/app/api/captains/route.ts`, `src/components/coach-captains.tsx`
- Modify: `src/components/coach-dashboard.tsx`

**Interfaces:**
- Consumes: `listCaptains`, `setCaptain`, `MissingCaptainsTable` (Task 2); `registeredPositions` (`account-profile.ts`); `isCoachSession`.
- Produces: `GET /api/captains → { ready: boolean; captains: TeamCaptain[]; teams: { teamId: TeamId; candidates: { id: string; name: string }[] }[] }`; `POST /api/captains { teamId, playerId: string | "" }` → misma forma.

- [ ] **Step 1: API** — `src/app/api/captains/route.ts`:

```ts
import { accountBody, accountFailure, accountReply, AccountError } from "@/lib/account-auth";
import { isCoachSession } from "@/lib/coach-session";
import { registeredPositions } from "@/lib/account-profile";
import { clubRepository } from "@/data/repository";
import { listCaptains, MissingCaptainsTable, setCaptain } from "@/lib/team-captains";
import type { TeamId } from "@/domain/types";
export const runtime = "nodejs";
const TEAMS: TeamId[] = ["a", "b"];
// Candidates: roster players with a linked account, so the captain can log in.
async function candidates() {
  const registered = await registeredPositions();
  return Promise.all(TEAMS.map(async teamId => ({ teamId, candidates: (await clubRepository.getPlayers(teamId)).filter(p => p.sourceId && p.sourceId in registered).map(p => ({ id: p.sourceId!, name: p.name })).sort((a, b) => a.name.localeCompare(b.name, "es")) })));
}
async function state() {
  const teams = await candidates();
  try { return { ready: true, captains: await listCaptains(), teams }; }
  catch (error) { if (error instanceof MissingCaptainsTable) return { ready: false, captains: [], teams }; throw error; }
}
export async function GET() {
  try { if (!await isCoachSession()) throw new AccountError("Inicia sesión como entrenador.", 401); return accountReply(await state()); }
  catch (error) { return accountFailure(error); }
}
export async function POST(request: Request) {
  try {
    const body = await accountBody(request);
    if (!await isCoachSession()) throw new AccountError("Inicia sesión como entrenador.", 401);
    const teamId = body.teamId; const playerId = body.playerId;
    if ((teamId !== "a" && teamId !== "b") || typeof playerId !== "string") throw new AccountError("Petición no válida.");
    if (playerId && !(await candidates()).find(t => t.teamId === teamId)?.candidates.some(c => c.id === playerId)) throw new AccountError("Ese jugador no tiene cuenta en este equipo.");
    try { await setCaptain(teamId, playerId || null); }
    catch (error) { if (error instanceof MissingCaptainsTable) throw new AccountError(error.message, 503); throw error; }
    return accountReply(await state());
  } catch (error) { return accountFailure(error); }
}
```

- [ ] **Step 2: Componente** — `src/components/coach-captains.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import type { TeamCaptain } from "@/domain/team-captain";
import { TableSkeleton } from "./skeletons";
type State = { ready: boolean; captains: TeamCaptain[]; teams: { teamId: "a" | "b"; candidates: { id: string; name: string }[] }[] };
export function CoachCaptains() {
  const [data, setData] = useState<State | null>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { void fetch("/api/captains", { cache: "no-store" }).then(r => r.json()).then(d => d.teams ? setData(d) : setMessage(d.error || "No se pudieron cargar los capitanes.")).catch(() => setMessage("No se pudieron cargar los capitanes.")); }, []);
  async function save(teamId: string, playerId: string) {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/captains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId, playerId }) }); const d = await response.json(); if (!response.ok) throw new Error(d.error); setData(d); setMessage("Capitán guardado."); }
    catch (e) { setMessage(e instanceof Error && e.message ? e.message : "No se pudo guardar."); } finally { setBusy(false); }
  }
  return <section className="panel account-card"><h2>Capitanes</h2><p>El capitán de cada equipo recibe el aviso y puede enviar al grupo de WhatsApp el resultado completo de la jornada.</p>
    {data === null && !message && <div role="status" aria-live="polite"><span className="sr-only">Cargando capitanes…</span><TableSkeleton rows={2}/></div>}
    {data && !data.ready && <p className="snp-warning">Falta la tabla de capitanes: el propietario de Supabase debe ejecutar supabase/team-captains.sql. Mientras tanto, solo el entrenador puede enviar el resultado.</p>}
    {data?.teams.map(team => <label key={team.teamId} className="captain-select">Equipo {team.teamId.toUpperCase()}<select disabled={busy || !data.ready} value={data.captains.find(c => c.team_id === team.teamId)?.player_id ?? ""} onChange={e => void save(team.teamId, e.target.value)}><option value="">Sin capitán</option>{team.candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>)}
    {message && <p role="status" className={message === "Capitán guardado." ? "data-note" : "snp-warning"}>{message}</p>}
  </section>;
}
```

CSS: `.captain-select { display: grid; gap: 6px; margin-top: 12px; font-weight: 600; } .captain-select select { max-width: 360px; }`

- [ ] **Step 3:** en `coach-dashboard.tsx`, importar `CoachCaptains` y renderizarlo justo después de `<CoachResults/>`.
- [ ] **Step 4:** `pnpm typecheck && pnpm lint && pnpm test` → PASS.
- [ ] **Step 5:** commit `feat: el entrenador elige los capitanes`.

### Task 5: Documentación y verificación manual

**Files:**
- Create: `docs/whatsapp-resultado.md`
- Modify: `.env.example`, `README.md`

- [ ] **Step 1:** `docs/whatsapp-resultado.md` con la activación (SQL del propietario, elegir capitanes), el flujo (chip → tarjeta → Enviar al grupo / Copiar), los límites (sin envío automático; los nombres dependen de la convocatoria SNP) y `DEV_CAPTAIN_PLAYER_ID`.
- [ ] **Step 2:** `.env.example`: `# Local only: marks this player_id as captain of their team(s). Ignored on Render/Vercel/production.` + `DEV_CAPTAIN_PLAYER_ID=`. En el README, el enlace a la nueva doc junto a la de resultados.
- [ ] **Step 3:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → todo PASS.
- [ ] **Step 4:** `pnpm dev`. Entrar como entrenador → abrir la última jornada con las 5 parejas → aparecen la tarjeta y el chip. Comprobar el enlace `wa.me` y Copiar. Con `DEV_CAPTAIN_PLAYER_ID`, entrar con esa cuenta de jugador → lo mismo. Con otra cuenta → nada.
- [ ] **Step 5:** commit `docs: activación del mensaje de WhatsApp para el capitán`.

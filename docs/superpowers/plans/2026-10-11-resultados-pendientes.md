# Resultados pendientes — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pedir a cada jugador con cuenta el resultado de su partido en la última jornada SNP cuando ni SNP ni la app lo tienen, con pop-up y chip de pendiente.

**Architecture:** Dos módulos de dominio puros (validación de sets y detección de pendientes) con tests. Una capa de almacenamiento Supabase/archivo igual que `mvp.ts`. Un servicio que junta calendario, acta SNP y datos guardados. Dos rutas API. Un componente cliente global en `AppShell` y una sección en el panel del entrenador.

**Tech Stack:** Next.js (versión del repo; leer `node_modules/next/dist/docs/` antes de tocar rutas), React, TypeScript, `node:test` vía `tsx --test`, Supabase REST, CSS en `src/app/globals.css`.

**Spec:** `docs/superpowers/specs/2026-10-11-resultados-pendientes-design.md`

## Global Constraints

- SNP es de solo lectura: no añadir rutas ni acciones de escritura a `snp-client.ts`.
- La identidad del usuario sale siempre de `currentAccount()` y `playerLink()` en el servidor, nunca del cuerpo de la petición.
- Margen tras la hora de inicio: `2 h` (`RESULT_DELAY_MS = 2 * 3600 * 1000`).
- Parejas: `1` a `5`. Sets guardados como `[nosotros, rivales]`.
- Set válido: 6–0…6–4, 7–5, 7–6. Súper tie-break (solo el tercero): ganador ≥ 10; si el ganador tiene 10, el perdedor ≤ 8; si tiene más de 10, diferencia exacta de 2.
- Tablas con RLS activada y permisos solo para `service_role`.
- `localStorage` solo para recordar el pop-up visto, siempre dentro de try/catch.
- Textos de la interfaz en español, con el tono de la app.
- Antes de cada commit: `pnpm test` en verde. Al final: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

**Cambio respecto a la spec (decidido al planificar):** `match_absences` incluye una columna `reason` (`absent` | `already_reported`). Sirve para un caso: sin pareja fijada, el compañero ya registró el resultado. El usuario ve ese resultado y pulsa «Es mi partido», así no se queda con un pendiente imposible de cerrar.

## Review Focus

1. Jugador compartido A/B con jornada pendiente en los dos equipos: deben salir dos pendientes independientes y resolver uno no debe cerrar el otro. Test en Task 3.
2. Fecha de la jornada sin hora (solo `YYYY-MM-DD`): no debe avisar ese mismo día. Test en Task 3.
3. Acta servida desde caché o captura (`stale`) sin alineación: no debe crear pendiente. Test en Task 3.
4. Envío con pareja fijada por el acta y un `pairIndex` distinto en el cuerpo: el servidor guarda la del acta. Test en Task 5.
5. Campos del cuadrante con un solo lado relleno («6» y vacío): error claro, no un set 6–0. Test en Task 2.

---

### Task 1: Verificar el acta en estado «convocado» y fijarla con un test

**Files:**
- Test: `tests/snp.test.ts` (añadir un test)
- Modify, solo si la verificación falla: `src/lib/snp-parser.ts:78-104`

**Interfaces:**
- Consumes: `parseMatch(html, id): SnpMatch` (existente).
- Produces: garantía de que un acta convocada sin sets devuelve `games[i].home/away` con IDs y `sets: []`, y que `games[i].index + 1` es el número de pareja.

- [ ] **Step 1: Comprobar con SNP real (requiere `.env.local` con `SNP_EMAIL` y `SNP_PASSWORD`)**

Elegir el `id` de un enfrentamiento de Fito A o B todavía sin jugar pero con convocatoria (aparece como «Pendiente» en `/equipos/a`, y el correo de convocatoria ya ha llegado). Ejecutar:

```bash
pnpm exec tsx -e 'import {snpClient} from "./src/lib/snp-client"; import {parseMatch} from "./src/lib/snp-parser"; const id=process.argv[1]; snpClient.html(`/enfrentamiento/edit/${id}/verG`).then(h=>{require("node:fs").writeFileSync(process.env.TMPDIR+"/acta-"+id+".html",h); console.log(JSON.stringify(parseMatch(h,id).games.map(g=>({i:g.index,home:g.home?.map(p=>p.id),away:g.away?.map(p=>p.id),sets:g.sets})),null,1));})' <ID>
```

Lo esperado: cinco elementos con IDs de jugador en el lado de Fito y `sets: []`. El HTML queda en `$TMPDIR`; **no se commitea** porque contiene datos de SNP. Si no hay credenciales, avisar al usuario y seguir con el Step 2. La verificación real queda pendiente para la prueba manual de la Task 6.

- [ ] **Step 2: Escribir el test de caracterización**

Añadir al final de `tests/snp.test.ts`:

```ts
test("lee un acta convocada sin sets con jugadores y orden de parejas",()=>{
  const pair=(n:number)=>`<div class="enf_partido_container"><div class="partido_jug_div" idjugador="${n}1" idpartido="9${n}">A${n} - 1000</div><div class="partido_jug_div" idjugador="${n}2">B${n} - 1000</div><div class="partido_jug_div" idjugador="${n}3">C${n} - 1000</div><div class="partido_jug_div" idjugador="${n}4">D${n} - 1000</div><div class="table_partidos"><table><tbody><tr><td>L</td><td class="td_part_res" set="1" eq="1"></td><td class="td_part_res" set="2" eq="1"></td><td class="td_part_res" set="3" eq="1"></td></tr><tr><td>V</td><td class="td_part_res" set="1" eq="2"></td><td class="td_part_res" set="2" eq="2"></td><td class="td_part_res" set="3" eq="2"></td></tr></tbody></table></div></div>`;
  const html=`<h4>Enfrentamiento (#60000)</h4><h2>Sábado 17/10/2026</h2><div class="partido_equipo_nombre_new" equipo="1" idequipo1="7778">Fito A</div><div class="partido_equipo_nombre_new" equipo="2" idequipo2="3349">Arcos</div>${[1,2,3,4,5].map(pair).join("")}`;
  const match=parseMatch(html,"60000");
  assert.equal(match.score,null);assert.equal(match.games.length,5);
  assert.deepEqual(match.games.map(g=>g.index+1),[1,2,3,4,5]);
  assert.deepEqual(match.games[2].home?.map(p=>p.id),["31","32"]);
  assert.ok(match.games.every(g=>g.sets.length===0));
});
```

Si el Step 1 mostró un HTML con otra estructura (por ejemplo, sin tabla `L/V` antes de jugar), reemplazar el HTML del test por una versión mínima de esa estructura real, con nombres e IDs inventados y sin datos privados.

- [ ] **Step 3: Ejecutar**

Run: `pnpm exec tsx --test tests/snp.test.ts`
Expected: PASS si la estructura coincide con las actas jugadas. Si FALLA con el HTML real, ajustar `parseMatch` para que una tarjeta sin tabla de resultados también produzca un `game` con `sets: []`, conservando los tests existentes, y repetir.

- [ ] **Step 4: Commit**

```bash
git add tests/snp.test.ts src/lib/snp-parser.ts
git commit -m "test: acta SNP convocada sin sets conserva jugadores y orden de parejas"
```

---

### Task 2: Validación de sets (dominio)

**Files:**
- Create: `src/domain/match-result.ts`
- Test: `tests/match-result.test.ts`

**Interfaces:**
- Produces:
  - `type SetScore = [number, number]`
  - `type SetsCheck = { ok: true; sets: SetScore[]; won: boolean; thirdSetNeeded: boolean } | { ok: false; error: string; thirdSetNeeded: boolean }`
  - `checkSets(input: unknown): SetsCheck`: `input` es un array de hasta 3 elementos `[n, n] | null`.
  - `cellsToSets(cells: string[][]): unknown`: convierte el cuadrante de la UI (`cells[set][0|1]`, strings) en la entrada de `checkSets`.

- [ ] **Step 1: Escribir los tests**

`tests/match-result.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { cellsToSets, checkSets } from "../src/domain/match-result";

test("acepta victoria en dos sets y exige el tercero vacío", () => {
  const ok = checkSets([[6, 4], [7, 5], null]);
  assert.deepEqual(ok, { ok: true, sets: [[6, 4], [7, 5]], won: true, thirdSetNeeded: false });
  assert.equal(checkSets([[4, 6], [6, 7], null]).ok, true);
  const extra = checkSets([[6, 4], [6, 3], [6, 0]]);
  assert.equal(extra.ok, false);
});
test("con 1-1 exige tercer set normal o súper tie-break", () => {
  assert.equal(checkSets([[6, 4], [3, 6], null]).ok, false);
  assert.equal(checkSets([[6, 4], [3, 6], null]).thirdSetNeeded, true);
  assert.deepEqual(checkSets([[6, 4], [3, 6], [7, 6]]), { ok: true, sets: [[6, 4], [3, 6], [7, 6]], won: true, thirdSetNeeded: true });
  assert.equal((checkSets([[6, 4], [3, 6], [8, 10]]) as { won: boolean }).won, false);
  assert.equal(checkSets([[6, 4], [3, 6], [12, 10]]).ok, true);
  assert.equal(checkSets([[6, 4], [3, 6], [10, 9]]).ok, false);
  assert.equal(checkSets([[6, 4], [3, 6], [13, 10]]).ok, false);
});
test("rechaza marcadores de set imposibles", () => {
  for (const bad of [[6, 5], [7, 4], [8, 6], [5, 3], [6, 6], [-1, 6], [6.5, 2]]) assert.equal(checkSets([bad, [6, 0], null]).ok, false, String(bad));
  assert.equal(checkSets([[10, 8], [6, 0], null]).ok, false);
  assert.equal(checkSets([[6, 0]]).ok, false);
  assert.equal(checkSets("6-0").ok, false);
  assert.equal(checkSets([[6, 0], [6, 0], null, null]).ok, false);
});
test("el cuadrante distingue celdas vacías de un lado sin rellenar", () => {
  assert.deepEqual(cellsToSets([["6", "4"], ["6", "2"], ["", ""]]), [[6, 4], [6, 2], null]);
  const half = checkSets(cellsToSets([["6", ""], ["6", "2"], ["", ""]]));
  assert.equal(half.ok, false);
  assert.match((half as { error: string }).error, /set 1/i);
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm exec tsx --test tests/match-result.test.ts`
Expected: FAIL con «Cannot find module '../src/domain/match-result'».

- [ ] **Step 3: Implementar**

`src/domain/match-result.ts`:

```ts
export type SetScore = [number, number];
export type SetsCheck = { ok: true; sets: SetScore[]; won: boolean; thirdSetNeeded: boolean } | { ok: false; error: string; thirdSetNeeded: boolean };
const games = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 99;
const asSet = (value: unknown): SetScore | null | undefined => value === null ? null : Array.isArray(value) && value.length === 2 && games(value[0]) && games(value[1]) ? [value[0], value[1]] : undefined;
const order = ([a, b]: SetScore) => a > b ? [a, b] : [b, a];
export function isRegularSet(set: SetScore) { const [w, l] = order(set); return (w === 6 && l <= 4) || (w === 7 && (l === 5 || l === 6)); }
export function isSuperTieBreak(set: SetScore) { const [w, l] = order(set); return w === 10 ? l <= 8 : w > 10 && w - l === 2; }
// Sets are always stored from our side: [nosotros, rivales].
export function checkSets(input: unknown): SetsCheck {
  const fail = (error: string, thirdSetNeeded = false): SetsCheck => ({ ok: false, error, thirdSetNeeded });
  if (!Array.isArray(input) || input.length < 2 || input.length > 3) return fail("Introduce al menos los dos primeros sets.");
  const sets = [0, 1, 2].map(i => asSet(input[i] ?? null));
  for (let i = 0; i < 3; i++) if (sets[i] === undefined) return fail(`Completa los dos lados del set ${i + 1} con números.`);
  const [first, second, third] = sets as (SetScore | null)[];
  if (!first || !second) return fail("Los sets 1 y 2 son obligatorios.");
  for (const [i, set] of [first, second].entries()) if (!isRegularSet(set)) return fail(`El set ${i + 1} no es un marcador válido (6-0 a 6-4, 7-5 o 7-6).`);
  const thirdSetNeeded = first[0] > first[1] !== second[0] > second[1];
  if (!thirdSetNeeded) return third ? fail("Con dos sets ganados por la misma pareja, deja vacío el tercero.") : { ok: true, sets: [first, second], won: first[0] > first[1], thirdSetNeeded };
  if (!third) return fail("Con un set para cada pareja, el tercer set es obligatorio.", true);
  if (!isRegularSet(third) && !isSuperTieBreak(third)) return fail("El tercer set no es válido (set normal o súper tie-break a 10 con dos de diferencia).", true);
  return { ok: true, sets: [first, second, third], won: third[0] > third[1], thirdSetNeeded };
}
export function cellsToSets(cells: string[][]): unknown {
  return cells.slice(0, 3).map(([ours = "", theirs = ""]) => {
    if (!ours.trim() && !theirs.trim()) return null;
    return [ours.trim() ? Number(ours) : NaN, theirs.trim() ? Number(theirs) : NaN];
  });
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `pnpm exec tsx --test tests/match-result.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/match-result.ts tests/match-result.test.ts
git commit -m "feat: validación de sets para resultados de jornada"
```

---

### Task 3: Detección de pendientes (dominio puro)

**Files:**
- Create: `src/domain/pending-results.ts`
- Test: `tests/pending-results.test.ts`

**Interfaces:**
- Consumes: `Fixture`, `TeamId` (`src/domain/types.ts`), `SnpMatch` (`src/domain/snp.ts`).
- Produces:
  - `RESULT_DELAY_MS: number`
  - `type PendingResult = { fixtureId: string; teamId: TeamId; round: number; date: string; opponent: string; home: boolean; pairLocked: number | null }`
  - `type ActaReading = { kind: "published" } | { kind: "absent" } | { kind: "convoked"; pair: number } | { kind: "no-lineup" } | { kind: "unknown" }`
  - `type ReportState = { dismissedFixtureIds: Set<string>; results: { fixtureId: string; teamId: TeamId; pairIndex: number; submittedBy: string }[] }`
  - `fixtureStart(date: string): number | null`
  - `lastPlayedFixture(fixtures: Fixture[], now: number): Fixture | null`
  - `readActa(match: SnpMatch | null, stale: boolean, ownSnpTeamId: string, home: boolean, playerId: string): ActaReading`
  - `pendingFor(input: { teamId: TeamId; fixture: Fixture; acta: ActaReading; userId: string; reports: ReportState }): PendingResult | null`

- [ ] **Step 1: Escribir los tests**

`tests/pending-results.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { fixtureStart, lastPlayedFixture, pendingFor, readActa, RESULT_DELAY_MS, type ReportState } from "../src/domain/pending-results";
import type { Fixture } from "../src/domain/types";
import type { SnpMatch } from "../src/domain/snp";

const fixture = (id: string, round: number, date: string, home = true): Fixture => ({ id, teamId: "a", round, opponent: "Arcos", date, venue: "", home, status: "pending", matches: [] });
const player = (id: string) => ({ id, name: id, photoUrl: null });
const acta = (games: { home: string[]; away: string[]; sets?: [number, number][] }[], teamIds: [string, string] = ["7778", "3349"]): SnpMatch => ({ id: "1", title: "", dateLabel: "", teams: ["Fito A", "Arcos"], teamIds, score: null, games: games.map((g, index) => ({ index, homePlayers: g.home, awayPlayers: g.away, home: g.home.map(player), away: g.away.map(player), sets: g.sets ?? [] })) });
const none: ReportState = { dismissedFixtureIds: new Set(), results: [] };

test("la última jornada exige dos horas desde el inicio", () => {
  const list = [fixture("1", 1, "2026-10-03T11:00:00.000Z"), fixture("2", 2, "2026-10-10T11:00:00.000Z"), fixture("3", 3, "2026-10-17T11:00:00.000Z")];
  const start = Date.parse("2026-10-10T11:00:00.000Z");
  assert.equal(lastPlayedFixture(list, start + RESULT_DELAY_MS - 1)?.id, "1");
  assert.equal(lastPlayedFixture(list, start + RESULT_DELAY_MS)?.id, "2");
  assert.equal(lastPlayedFixture(list, Date.parse("2026-09-01T00:00:00Z")), null);
  assert.equal(lastPlayedFixture([fixture("x", 1, "")], Date.now()), null);
});
test("una fecha sin hora no avisa hasta el día siguiente", () => {
  const start = fixtureStart("2026-10-10")!;
  assert.ok(start >= Date.parse("2026-10-10T23:00:00Z"));
  assert.equal(lastPlayedFixture([fixture("1", 1, "2026-10-10")], Date.parse("2026-10-10T20:00:00Z")), null);
  assert.equal(lastPlayedFixture([fixture("1", 1, "2026-10-10")], Date.parse("2026-10-11T09:00:00Z"))?.id, "1");
});
test("lee el acta desde el lado propio", () => {
  const convoked = acta([{ home: ["10", "11"], away: ["90", "91"] }, { home: ["12", "13"], away: ["92", "93"] }]);
  assert.deepEqual(readActa(convoked, false, "7778", true, "13"), { kind: "convoked", pair: 2 });
  assert.deepEqual(readActa(convoked, false, "7778", true, "99"), { kind: "absent" });
  assert.deepEqual(readActa(convoked, false, "7778", true, "92"), { kind: "absent" });
  const away = acta([{ home: ["90", "91"], away: ["10", "11"] }], ["3349", "7778"]);
  assert.deepEqual(readActa(away, false, "7778", false, "11"), { kind: "convoked", pair: 1 });
  const played = acta([{ home: ["10", "11"], away: ["90", "91"], sets: [[6, 2]] }]);
  assert.deepEqual(readActa(played, false, "7778", true, "10"), { kind: "published" });
});
test("sin alineación: pendiente libre si es SNP en vivo, nada si es caché o fallo", () => {
  const empty = acta([]);
  assert.deepEqual(readActa(empty, false, "7778", true, "10"), { kind: "no-lineup" });
  assert.deepEqual(readActa(empty, true, "7778", true, "10"), { kind: "unknown" });
  assert.deepEqual(readActa(null, false, "7778", true, "10"), { kind: "unknown" });
});
test("los datos de la app resuelven el pendiente", () => {
  const f = fixture("55", 7, "2026-10-10T11:00:00.000Z");
  const base = { teamId: "a" as const, fixture: f, userId: "u1" };
  assert.deepEqual(pendingFor({ ...base, acta: { kind: "convoked", pair: 3 }, reports: none }), { fixtureId: "55", teamId: "a", round: 7, date: f.date, opponent: "Arcos", home: true, pairLocked: 3 });
  assert.equal(pendingFor({ ...base, acta: { kind: "published" }, reports: none }), null);
  assert.equal(pendingFor({ ...base, acta: { kind: "absent" }, reports: none }), null);
  assert.equal(pendingFor({ ...base, acta: { kind: "unknown" }, reports: none }), null);
  assert.equal(pendingFor({ ...base, acta: { kind: "no-lineup" }, reports: { dismissedFixtureIds: new Set(["55"]), results: [] } }), null);
  const partner: ReportState = { dismissedFixtureIds: new Set(), results: [{ fixtureId: "55", teamId: "a", pairIndex: 3, submittedBy: "u2" }] };
  assert.equal(pendingFor({ ...base, acta: { kind: "convoked", pair: 3 }, reports: partner }), null);
  assert.equal(pendingFor({ ...base, acta: { kind: "convoked", pair: 2 }, reports: partner })?.pairLocked, 2);
  assert.equal(pendingFor({ ...base, acta: { kind: "no-lineup" }, reports: partner })?.pairLocked, null);
  const mine: ReportState = { dismissedFixtureIds: new Set(), results: [{ fixtureId: "55", teamId: "a", pairIndex: 1, submittedBy: "u1" }] };
  assert.equal(pendingFor({ ...base, acta: { kind: "no-lineup" }, reports: mine }), null);
});
test("jugador compartido: un resultado del equipo B no resuelve el A", () => {
  const f = fixture("55", 7, "2026-10-10T11:00:00.000Z");
  const otherTeam: ReportState = { dismissedFixtureIds: new Set(), results: [{ fixtureId: "55", teamId: "b", pairIndex: 1, submittedBy: "u1" }] };
  assert.ok(pendingFor({ teamId: "a", fixture: f, acta: { kind: "no-lineup" }, userId: "u1", reports: otherTeam }));
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm exec tsx --test tests/pending-results.test.ts`
Expected: FAIL con «Cannot find module».

- [ ] **Step 3: Implementar**

`src/domain/pending-results.ts`:

```ts
import type { Fixture, TeamId } from "./types";
import type { SnpMatch, SnpMatchPlayer } from "./snp";
export const RESULT_DELAY_MS = 2 * 3600 * 1000;
export type PendingResult = { fixtureId: string; teamId: TeamId; round: number; date: string; opponent: string; home: boolean; pairLocked: number | null };
export type ActaReading = { kind: "published" } | { kind: "absent" } | { kind: "convoked"; pair: number } | { kind: "no-lineup" } | { kind: "unknown" };
export type ReportState = { dismissedFixtureIds: Set<string>; results: { fixtureId: string; teamId: TeamId; pairIndex: number; submittedBy: string }[] };
// Dates without time are treated as the end of that day: never prompt during matchday.
export function fixtureStart(date: string): number | null {
  if (!date) return null;
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T23:59:59Z` : date);
  return Number.isNaN(time) ? null : time;
}
export function lastPlayedFixture(fixtures: Fixture[], now: number): Fixture | null {
  let best: { fixture: Fixture; start: number } | null = null;
  for (const fixture of fixtures) {
    const start = fixtureStart(fixture.date);
    if (start === null || start + RESULT_DELAY_MS > now) continue;
    if (!best || start > best.start || (start === best.start && fixture.round > best.fixture.round)) best = { fixture, start };
  }
  return best?.fixture ?? null;
}
export function readActa(match: SnpMatch | null, stale: boolean, ownSnpTeamId: string, home: boolean, playerId: string): ActaReading {
  if (!match) return { kind: "unknown" };
  const index = match.teamIds?.indexOf(ownSnpTeamId) ?? -1;
  const side = index >= 0 ? index : home ? 0 : 1;
  const own = (game: SnpMatch["games"][number]): SnpMatchPlayer[] => (side === 0 ? game.home : game.away) ?? [];
  if (!match.games.some(game => own(game).some(p => p.id))) return stale ? { kind: "unknown" } : { kind: "no-lineup" };
  const game = match.games.find(g => own(g).some(p => p.id === playerId));
  if (!game) return { kind: "absent" };
  return game.sets.length ? { kind: "published" } : { kind: "convoked", pair: game.index + 1 };
}
export function pendingFor({ teamId, fixture, acta, userId, reports }: { teamId: TeamId; fixture: Fixture; acta: ActaReading; userId: string; reports: ReportState }): PendingResult | null {
  if (acta.kind !== "convoked" && acta.kind !== "no-lineup") return null;
  if (reports.dismissedFixtureIds.has(fixture.id)) return null;
  const same = reports.results.filter(r => r.fixtureId === fixture.id && r.teamId === teamId);
  if (acta.kind === "convoked" && same.some(r => r.pairIndex === acta.pair)) return null;
  if (acta.kind === "no-lineup" && same.some(r => r.submittedBy === userId)) return null;
  return { fixtureId: fixture.id, teamId, round: fixture.round, date: fixture.date, opponent: fixture.opponent, home: fixture.home, pairLocked: acta.kind === "convoked" ? acta.pair : null };
}
```

Nota: `dismissedFixtureIds` se compara solo por `fixture.id`, sin equipo. Es correcto porque un enfrentamiento SNP pertenece a un único equipo de Fito (A y B están en divisiones distintas).

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `pnpm exec tsx --test tests/pending-results.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/pending-results.ts tests/pending-results.test.ts
git commit -m "feat: detección de resultados pendientes a partir de calendario y acta"
```

---

### Task 4: Almacenamiento (SQL y librería)

**Files:**
- Create: `supabase/match-results.sql`
- Create: `src/lib/match-results.ts`
- Test: `tests/match-results-store.test.ts`

**Interfaces:**
- Consumes: `SetScore` (Task 2), `TeamId`.
- Produces:
  - `type MatchResultRow = { fixture_id: string; team_id: TeamId; pair_index: number; sets: SetScore[]; player_id: string; submitted_by: string; created_at: string }`
  - `type MatchAbsenceRow = { user_id: string; fixture_id: string; reason: "absent" | "already_reported"; created_at: string }`
  - `class DuplicateResultError extends Error {}`
  - `listResults(fixtureIds: string[]): Promise<MatchResultRow[]>`
  - `listAbsences(userId: string): Promise<MatchAbsenceRow[]>`
  - `saveResult(row: MatchResultRow): Promise<void>`: lanza `DuplicateResultError` si ya existe la clave.
  - `saveAbsence(row: MatchAbsenceRow): Promise<void>`: idempotente.
  - `deleteResult(fixtureId: string, teamId: TeamId, pairIndex: number): Promise<void>`

- [ ] **Step 1: SQL**

`supabase/match-results.sql`:

```sql
-- Club record of results entered by players. SNP is never written from the app.
create table if not exists public.match_results (
  fixture_id text not null check (fixture_id ~ '^[0-9]{1,10}$'),
  team_id text not null check (team_id in ('a', 'b')),
  pair_index smallint not null check (pair_index between 1 and 5),
  sets jsonb not null,
  player_id text not null,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (fixture_id, team_id, pair_index)
);
create table if not exists public.match_absences (
  user_id uuid not null references auth.users(id) on delete cascade,
  fixture_id text not null check (fixture_id ~ '^[0-9]{1,10}$'),
  reason text not null default 'absent' check (reason in ('absent', 'already_reported')),
  created_at timestamptz not null default now(),
  primary key (user_id, fixture_id)
);
alter table public.match_results enable row level security;
alter table public.match_absences enable row level security;
revoke all on public.match_results from anon, authenticated;
revoke all on public.match_absences from anon, authenticated;
grant select, insert, delete on public.match_results to service_role;
grant select, insert on public.match_absences to service_role;
```

- [ ] **Step 2: Escribir el test del modo archivo (desarrollo)**

`tests/match-results-store.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DuplicateResultError, deleteResult, listAbsences, listResults, saveAbsence, saveResult } from "../src/lib/match-results";

test("guarda resultados y ausencias en archivo privado sin Supabase", async () => {
  const saved = { cwd: process.cwd(), url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, render: process.env.RENDER, vercel: process.env.VERCEL };
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SECRET_KEY; delete process.env.RENDER; delete process.env.VERCEL;
  const dir = await mkdtemp(path.join(tmpdir(), "fito-results-"));
  process.chdir(dir);
  try {
    const row = { fixture_id: "55", team_id: "a" as const, pair_index: 2, sets: [[6, 4], [6, 3]] as [number, number][], player_id: "10", submitted_by: "u1", created_at: "2026-10-10T14:00:00.000Z" };
    await saveResult(row);
    await assert.rejects(saveResult({ ...row, submitted_by: "u2" }), DuplicateResultError);
    assert.deepEqual(await listResults(["55"]), [row]);
    assert.deepEqual(await listResults(["99"]), []);
    await saveAbsence({ user_id: "u1", fixture_id: "55", reason: "absent", created_at: row.created_at });
    await saveAbsence({ user_id: "u1", fixture_id: "55", reason: "absent", created_at: row.created_at });
    assert.equal((await listAbsences("u1")).length, 1);
    assert.equal((await listAbsences("u2")).length, 0);
    await deleteResult("55", "a", 2);
    assert.deepEqual(await listResults(["55"]), []);
  } finally {
    process.chdir(saved.cwd); await rm(dir, { recursive: true, force: true });
    for (const [k, v] of [["SUPABASE_URL", saved.url], ["SUPABASE_SECRET_KEY", saved.key], ["RENDER", saved.render], ["VERCEL", saved.vercel]] as const) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});
```

- [ ] **Step 3: Ejecutar y ver que falla**

Run: `pnpm exec tsx --test tests/match-results-store.test.ts`
Expected: FAIL con «Cannot find module».

- [ ] **Step 4: Implementar**

`src/lib/match-results.ts` (mismo patrón que `src/lib/mvp.ts`):

```ts
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { TeamId } from "@/domain/types";
import type { SetScore } from "@/domain/match-result";
export type MatchResultRow = { fixture_id: string; team_id: TeamId; pair_index: number; sets: SetScore[]; player_id: string; submitted_by: string; created_at: string };
export type MatchAbsenceRow = { user_id: string; fixture_id: string; reason: "absent" | "already_reported"; created_at: string };
export class DuplicateResultError extends Error {}
const RESULT_FIELDS = "fixture_id,team_id,pair_index,sets,player_id,submitted_by,created_at";
let pending: Promise<void> = Promise.resolve();
function supabase() {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SECRET_KEY;
  if (url && key) return { url, key };
  if (process.env.RENDER === "true" || process.env.VERCEL === "1" || url || key) throw new Error("Configura Supabase para conservar los resultados.");
  return null;
}
async function rest(table: string, method: string, params: Record<string, string>, body?: object, prefer = "return=minimal") {
  const { url, key } = supabase()!;
  const endpoint = new URL(`/rest/v1/${table}`, url);
  if (endpoint.protocol !== "https:") throw new Error("URL no válida");
  for (const [k, v] of Object.entries(params)) endpoint.searchParams.set(k, v);
  const response = await fetch(endpoint, { method, cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", Prefer: prefer }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (response.status === 409) throw new DuplicateResultError("Este resultado ya lo ha registrado otro jugador.");
  if (!response.ok) throw new Error(`No se pudo acceder a ${table}. Ejecuta supabase/match-results.sql si falta la tabla.`);
  return method === "GET" ? response.json() : null;
}
async function readFileRows<T>(file: string): Promise<T[]> { try { return JSON.parse(await readFile(file, "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; } }
async function updateFile<T>(file: string, change: (rows: T[]) => T[]) {
  const operation = pending.then(async () => { const next = change(await readFileRows<T>(file)); await mkdir(".club-private", { recursive: true }); const tmp = `${file}.${randomUUID()}.tmp`; await writeFile(tmp, JSON.stringify(next), { mode: 0o600 }); await rename(tmp, file); });
  pending = operation.catch(() => {}); await operation;
}
const RESULTS_FILE = ".club-private/match-results.json"; const ABSENCES_FILE = ".club-private/match-absences.json";
const sameKey = (a: Pick<MatchResultRow, "fixture_id" | "team_id" | "pair_index">, b: typeof a) => a.fixture_id === b.fixture_id && a.team_id === b.team_id && a.pair_index === b.pair_index;
export async function listResults(fixtureIds: string[]): Promise<MatchResultRow[]> {
  const ids = fixtureIds.filter(id => /^\d{1,10}$/.test(id)); if (!ids.length) return [];
  if (supabase()) return rest("match_results", "GET", { select: RESULT_FIELDS, fixture_id: `in.(${ids.join(",")})`, order: "fixture_id.asc,team_id.asc,pair_index.asc" });
  return (await readFileRows<MatchResultRow>(RESULTS_FILE)).filter(row => ids.includes(row.fixture_id));
}
export async function listAbsences(userId: string): Promise<MatchAbsenceRow[]> {
  if (supabase()) return rest("match_absences", "GET", { select: "user_id,fixture_id,reason,created_at", user_id: `eq.${userId}` });
  return (await readFileRows<MatchAbsenceRow>(ABSENCES_FILE)).filter(row => row.user_id === userId);
}
export async function saveResult(row: MatchResultRow) {
  if (supabase()) { await rest("match_results", "POST", {}, row); return; }
  let duplicate = false;
  await updateFile<MatchResultRow>(RESULTS_FILE, rows => { duplicate = rows.some(r => sameKey(r, row)); return duplicate ? rows : [...rows, row]; });
  if (duplicate) throw new DuplicateResultError("Este resultado ya lo ha registrado otro jugador.");
}
export async function saveAbsence(row: MatchAbsenceRow) {
  if (supabase()) { await rest("match_absences", "POST", { on_conflict: "user_id,fixture_id" }, row, "resolution=ignore-duplicates,return=minimal"); return; }
  await updateFile<MatchAbsenceRow>(ABSENCES_FILE, rows => rows.some(r => r.user_id === row.user_id && r.fixture_id === row.fixture_id) ? rows : [...rows, row]);
}
export async function deleteResult(fixtureId: string, teamId: TeamId, pairIndex: number) {
  if (supabase()) { await rest("match_results", "DELETE", { fixture_id: `eq.${fixtureId}`, team_id: `eq.${teamId}`, pair_index: `eq.${pairIndex}` }); return; }
  await updateFile<MatchResultRow>(RESULTS_FILE, rows => rows.filter(r => !sameKey(r, { fixture_id: fixtureId, team_id: teamId, pair_index: pairIndex })));
}
```

- [ ] **Step 5: Ejecutar y ver que pasa**

Run: `pnpm exec tsx --test tests/match-results-store.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/match-results.sql src/lib/match-results.ts tests/match-results-store.test.ts
git commit -m "feat: almacenamiento de resultados y ausencias de jornada"
```

---

### Task 5: Servicio y rutas API

**Files:**
- Modify: `src/data/repository.ts:8` (exportar `sourceTeams`)
- Create: `src/lib/pending-results-service.ts`
- Create: `src/app/api/results/pending/route.ts`
- Create: `src/app/api/results/route.ts`
- Test: `tests/results-api.test.ts`

**Interfaces:**
- Consumes: `clubRepository.getPlayers/getFixtures`, `getSnpMatch(id): Promise<SnpResult<SnpMatch>>`, `lastPlayedFixture`, `readActa`, `pendingFor`, `checkSets`, todo lo de Task 4, `currentAccount`, `playerLink`, `accountBody`, `accountReply`, `accountFailure`, `AccountError`, `limitAccountAttempts`, `requireSameOrigin`, `isCoachSession`.
- Produces:
  - `export const sourceTeams: Record<TeamId, string>` en `repository.ts`
  - `pendingResults(userId: string, playerId: string, now?: number): Promise<PendingResult[]>`
  - `coachResults(now?: number): Promise<CoachTeamResults[]>`, con `type CoachTeamResults = { teamId: TeamId; fixture: { id: string; round: number; opponent: string; date: string } | null; results: (MatchResultRow & { player_name: string })[] }`
  - `GET /api/results/pending` → `{ pending: PendingResult[] }`
  - `POST /api/results` con `{ action: "result" | "absent" | "confirm", fixtureId, teamId, pairIndex?, sets? }` → `{ ok: true, pending }` o error `{ error, existing?: SetScore[] }` con 400/401/403/409/429
  - `GET /api/results` (entrenador) → `{ teams: CoachTeamResults[] }`
  - `DELETE /api/results` (entrenador) con `{ fixtureId, teamId, pairIndex }` → `{ ok: true, teams }`

- [ ] **Step 1: Leer la guía de rutas de esta versión de Next**

Run: `ls node_modules/next/dist/docs/ && grep -ril "route handler" node_modules/next/dist/docs | head`
Leer la guía de Route Handlers y confirmar que `export async function GET/POST/DELETE(request: Request)` y `export const runtime = "nodejs"` siguen siendo válidos, como en `src/app/api/mvp/route.ts`. Si hay diferencias, seguir la guía.

- [ ] **Step 2: Exportar `sourceTeams`**

En `src/data/repository.ts`, cambiar la línea 8:

```ts
export const sourceTeams: Record<TeamId, string> = { a: "7778", b: "803902" };
```

- [ ] **Step 3: Escribir los tests de la API**

`tests/results-api.test.ts` (fuera del contexto de petición, `cookies()` falla, así que solo se prueban las defensas previas a la sesión, igual que `tests/lineups-api.test.ts`):

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST, DELETE } from "../src/app/api/results/route";
import { resolvePair } from "../src/lib/pending-results-service";

const request = (method: string, origin: string, body: string) => new Request("http://localhost/api/results", { method, headers: { origin, host: "localhost", "Content-Type": "application/json" }, body });

test("la API de resultados rechaza otro origen y cuerpos grandes antes de leer la sesión", async () => {
  assert.equal((await POST(request("POST", "http://example.com", JSON.stringify({ action: "absent", fixtureId: "1", teamId: "a" })))).status, 403);
  assert.equal((await POST(request("POST", "http://localhost", "x".repeat(6000)))).status, 413);
  assert.equal((await DELETE(request("DELETE", "http://example.com", "{}"))).status, 403);
});
test("la pareja fijada por el acta prevalece sobre la enviada", () => {
  assert.equal(resolvePair(3, 1), 3);
  assert.equal(resolvePair(null, 4), 4);
  assert.equal(resolvePair(null, 0), null);
  assert.equal(resolvePair(null, 6), null);
  assert.equal(resolvePair(null, "2"), null);
});
```

- [ ] **Step 4: Ejecutar y ver que falla**

Run: `pnpm exec tsx --test tests/results-api.test.ts`
Expected: FAIL con «Cannot find module».

- [ ] **Step 5: Implementar el servicio**

`src/lib/pending-results-service.ts`:

```ts
import { clubRepository, sourceTeams } from "@/data/repository";
import { getSnpMatch } from "./snp-service";
import { lastPlayedFixture, pendingFor, readActa, type ActaReading, type PendingResult } from "@/domain/pending-results";
import { listAbsences, listResults, type MatchResultRow } from "./match-results";
import type { Fixture, TeamId } from "@/domain/types";
const TEAMS: TeamId[] = ["a", "b"];
export type CoachTeamResults = { teamId: TeamId; fixture: { id: string; round: number; opponent: string; date: string } | null; results: (MatchResultRow & { player_name: string })[] };
export function resolvePair(locked: number | null, requested: unknown): number | null {
  if (locked) return locked;
  return Number.isInteger(requested) && (requested as number) >= 1 && (requested as number) <= 5 ? requested as number : null;
}
async function lastFixture(team: TeamId, now: number): Promise<Fixture | null> {
  try { return lastPlayedFixture(await clubRepository.getFixtures(team), now); } catch { return null; }
}
// SNP failures never create a reminder: the next check will retry.
export async function pendingResults(userId: string, playerId: string, now = Date.now()): Promise<PendingResult[]> {
  const candidates: { team: TeamId; fixture: Fixture; acta: ActaReading }[] = [];
  for (const team of TEAMS) {
    try {
      if (!(await clubRepository.getPlayers(team)).some(p => p.sourceId === playerId)) continue;
      const fixture = await lastFixture(team, now); if (!fixture) continue;
      let acta: ActaReading = { kind: "unknown" };
      try { const result = await getSnpMatch(fixture.id); acta = readActa(result.data, result.stale, sourceTeams[team], fixture.home, playerId); } catch { /* unknown */ }
      candidates.push({ team, fixture, acta });
    } catch { continue; }
  }
  if (!candidates.length) return [];
  const [absences, results] = await Promise.all([listAbsences(userId), listResults(candidates.map(c => c.fixture.id))]);
  const reports = { dismissedFixtureIds: new Set(absences.map(a => a.fixture_id)), results: results.map(r => ({ fixtureId: r.fixture_id, teamId: r.team_id, pairIndex: r.pair_index, submittedBy: r.submitted_by })) };
  return candidates.flatMap(c => pendingFor({ teamId: c.team, fixture: c.fixture, acta: c.acta, userId, reports }) ?? []);
}
export async function coachResults(now = Date.now()): Promise<CoachTeamResults[]> {
  return Promise.all(TEAMS.map(async teamId => {
    const fixture = await lastFixture(teamId, now);
    if (!fixture) return { teamId, fixture: null, results: [] };
    const [rows, players] = await Promise.all([listResults([fixture.id]), clubRepository.getPlayers(teamId).catch(() => [])]);
    const name = (id: string) => players.find(p => p.sourceId === id)?.name ?? "Jugador";
    return { teamId, fixture: { id: fixture.id, round: fixture.round, opponent: fixture.opponent, date: fixture.date }, results: rows.filter(r => r.team_id === teamId).map(r => ({ ...r, player_name: name(r.player_id) })) };
  }));
}
```

- [ ] **Step 6: Implementar `GET /api/results/pending`**

`src/app/api/results/pending/route.ts`:

```ts
import { accountFailure, accountReply, currentAccount } from "@/lib/account-auth";
import { playerLink } from "@/lib/account-profile";
import { pendingResults } from "@/lib/pending-results-service";
export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await currentAccount();
    if (!user) return accountReply({ error: "Inicia sesión para acceder a la web." }, 401);
    if (user.role === "coach" || user.role === "visitor") return accountReply({ pending: [] });
    const link = await playerLink(user.id);
    return accountReply({ pending: link ? await pendingResults(user.id, link.player_id) : [] });
  } catch (error) { return accountFailure(error); }
}
```

- [ ] **Step 7: Implementar `/api/results`**

`src/app/api/results/route.ts`:

```ts
import { accountBody, accountFailure, accountReply, AccountError, currentAccount, limitAccountAttempts } from "@/lib/account-auth";
import { playerLink } from "@/lib/account-profile";
import { isCoachSession } from "@/lib/coach-session";
import { checkSets } from "@/domain/match-result";
import { coachResults, pendingResults, resolvePair } from "@/lib/pending-results-service";
import { deleteResult, DuplicateResultError, listResults, saveAbsence, saveResult } from "@/lib/match-results";
import type { TeamId } from "@/domain/types";
export const runtime = "nodejs";
const isTeam = (value: unknown): value is TeamId => value === "a" || value === "b";
const isFixture = (value: unknown): value is string => typeof value === "string" && /^\d{1,10}$/.test(value);
export async function GET() {
  try {
    if (!await isCoachSession()) throw new AccountError("Inicia sesión como entrenador.", 401);
    return accountReply({ teams: await coachResults() });
  } catch (error) { return accountFailure(error); }
}
export async function POST(request: Request) {
  try {
    const body = await accountBody(request);
    const user = await currentAccount();
    if (!user) throw new AccountError("Inicia sesión para registrar resultados.", 401);
    if (user.role === "coach" || user.role === "visitor") throw new AccountError("Solo los jugadores registran resultados.", 403);
    limitAccountAttempts(`result:${user.id}`);
    if (!isTeam(body.teamId) || !isFixture(body.fixtureId) || !["result", "absent", "confirm"].includes(String(body.action))) throw new AccountError("Petición no válida.");
    const link = await playerLink(user.id); if (!link) throw new AccountError("Vincula primero tu ficha SNP.");
    const pending = (await pendingResults(user.id, link.player_id)).find(p => p.fixtureId === body.fixtureId && p.teamId === body.teamId);
    if (!pending) throw new AccountError("Esta jornada ya no tiene resultado pendiente.", 409);
    const now = new Date().toISOString();
    if (body.action === "absent") await saveAbsence({ user_id: user.id, fixture_id: pending.fixtureId, reason: "absent", created_at: now });
    else {
      const pair = resolvePair(pending.pairLocked, body.pairIndex);
      if (!pair) throw new AccountError("Elige tu número de pareja (1 a 5).");
      if (body.action === "confirm") {
        if (pending.pairLocked) throw new AccountError("Petición no válida.");
        const existing = (await listResults([pending.fixtureId])).find(r => r.team_id === pending.teamId && r.pair_index === pair);
        if (!existing) throw new AccountError("No hay ningún resultado registrado para esa pareja.");
        await saveAbsence({ user_id: user.id, fixture_id: pending.fixtureId, reason: "already_reported", created_at: now });
      } else {
        const check = checkSets(body.sets);
        if (!check.ok) throw new AccountError(check.error);
        try { await saveResult({ fixture_id: pending.fixtureId, team_id: pending.teamId, pair_index: pair, sets: check.sets, player_id: link.player_id, submitted_by: user.id, created_at: now }); }
        catch (error) {
          if (!(error instanceof DuplicateResultError)) throw error;
          const existing = (await listResults([pending.fixtureId])).find(r => r.team_id === pending.teamId && r.pair_index === pair);
          return accountReply({ error: "Esta pareja ya tiene resultado registrado por un compañero.", existing: existing?.sets ?? null, pairIndex: pair }, 409);
        }
      }
    }
    return accountReply({ ok: true, pending: await pendingResults(user.id, link.player_id) });
  } catch (error) { return accountFailure(error); }
}
export async function DELETE(request: Request) {
  try {
    const body = await accountBody(request);
    if (!await isCoachSession()) throw new AccountError("Inicia sesión como entrenador.", 401);
    const pair = resolvePair(null, body.pairIndex);
    if (!isTeam(body.teamId) || !isFixture(body.fixtureId) || !pair) throw new AccountError("Petición no válida.");
    await deleteResult(body.fixtureId, body.teamId, pair);
    return accountReply({ ok: true, teams: await coachResults() });
  } catch (error) { return accountFailure(error); }
}
```

- [ ] **Step 8: Ejecutar tests y typecheck**

Run: `pnpm exec tsx --test tests/results-api.test.ts && pnpm typecheck`
Expected: PASS y sin errores de tipos. `accountBody` ya devuelve 403 por origen y 413 por tamaño antes de llamar a `currentAccount`.

- [ ] **Step 9: Comprobar que el proxy protege `/api/results`**

`src/proxy.ts` deja pasar sin sesión solo `/acceso`, `/api/account*` y `/api/health`. Confirmar con `grep -n "api/results" src/proxy.ts`: no debe aparecer, porque así queda protegido. Si existe `scripts/check-routes.mjs` con una lista de rutas, añadir `/api/results` y `/api/results/pending` siguiendo su formato y ejecutar `node scripts/check-routes.mjs`.

- [ ] **Step 10: Commit**

```bash
git add src/data/repository.ts src/lib/pending-results-service.ts src/app/api/results tests/results-api.test.ts scripts/check-routes.mjs
git commit -m "feat: API de resultados pendientes y registro por jugadores"
```

---

### Task 6: Pop-up y chip en la app

**Files:**
- Create: `src/components/result-reminder.tsx`
- Modify: `src/components/app-shell.tsx` (montar el componente)
- Modify: `src/app/globals.css` (estilos al final del archivo)

**Interfaces:**
- Consumes: `GET /api/results/pending`, `POST /api/results`, `PendingResult`, `checkSets`, `cellsToSets`, `formatDate` y `formatTime` de `src/lib/format.ts` (comprobar los nombres con `grep -n export src/lib/format.ts`).
- Produces: `<ResultReminder />` sin props.

- [ ] **Step 1: Implementar el componente**

`src/components/result-reminder.tsx`:

```tsx
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Lock, X } from "lucide-react";
import { cellsToSets, checkSets, type SetScore } from "@/domain/match-result";
import type { PendingResult } from "@/domain/pending-results";
import { formatDate } from "@/lib/format";
const SEEN_KEY = "fito-result-seen";
const emptyCells = () => [["", ""], ["", ""], ["", ""]];
function seen(): string[] { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch { return []; } }
function markSeen(id: string) { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen().filter(x => x !== id), id].slice(-20))); } catch { /* Private mode: the dialog may open again. */ } }
export function ResultReminder() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<PendingResult[]>([]);
  const [pair, setPair] = useState<number | null>(null);
  const [cells, setCells] = useState(emptyCells);
  const [message, setMessage] = useState("");
  const [existing, setExisting] = useState<SetScore[] | null>(null);
  const [busy, setBusy] = useState(false);
  const current = pending[0];
  const reset = useCallback((next?: PendingResult) => { setPair(next?.pairLocked ?? null); setCells(emptyCells()); setMessage(""); setExisting(null); }, []);
  const open = useCallback(() => { if (!current) return; markSeen(current.fixtureId); dialog.current?.showModal(); }, [current]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/results/pending", { signal: controller.signal, cache: "no-store" }).then(r => r.ok ? r.json() : { pending: [] }).then(data => setPending(Array.isArray(data.pending) ? data.pending : [])).catch(() => {});
    return () => controller.abort();
  }, [pathname]);
  useEffect(() => { reset(current); if (current && !seen().includes(current.fixtureId) && !dialog.current?.open) open(); }, [current?.fixtureId]); // eslint-disable-line react-hooks/exhaustive-deps
  const check = checkSets(cellsToSets(cells));
  const firstTwoDecided = !check.thirdSetNeeded && checkSets(cellsToSets([cells[0], cells[1], ["", ""]])).ok;
  // A third set is not allowed once the first two have a winner: clear stale input.
  useEffect(() => { if (firstTwoDecided) setCells(c => c[2][0] || c[2][1] ? [c[0], c[1], ["", ""]] : c); }, [firstTwoDecided]);
  async function send(action: "result" | "absent" | "confirm") {
    if (!current) return;
    const sets = cellsToSets(cells);
    if (action === "result") { const check = checkSets(sets); if (!check.ok) { setMessage(check.error); return; } if (!pair) { setMessage("Elige tu número de pareja."); return; } }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, fixtureId: current.fixtureId, teamId: current.teamId, pairIndex: pair, sets }) });
      const data = await response.json();
      if (response.status === 409 && data.existing) { setExisting(data.existing); setMessage(data.error); return; }
      if (!response.ok) { setMessage(data.error || "No se pudo guardar. Inténtalo de nuevo."); return; }
      dialog.current?.close(); setPending(data.pending ?? []);
    } catch { setMessage("No se pudo guardar. Comprueba la conexión."); } finally { setBusy(false); }
  }
  if (!current) return null;
  const title = `Jornada ${current.round} · ${current.teamId === "a" ? "Fito A" : "Fito B"} vs ${current.opponent}`;
  return <>
    <button type="button" className="result-chip" onClick={open} aria-haspopup="dialog"><AlertTriangle size={16} aria-hidden/>Resultado pendiente · J{current.round}{pending.length > 1 && <b>{pending.length}</b>}</button>
    <dialog ref={dialog} className="result-dialog" aria-labelledby="result-title">
      <form method="dialog" className="result-dialog-body" onSubmit={e => { e.preventDefault(); void send("result"); }}>
        <header><div><span className="result-eyebrow">¿Cómo fue tu partido?</span><h2 id="result-title">{title}</h2><p>{formatDate(current.date)}</p></div><button type="button" className="result-close" aria-label="Cerrar" onClick={() => dialog.current?.close()}><X size={18}/></button></header>
        <fieldset className="result-pairs" disabled={Boolean(current.pairLocked)}><legend>Pareja {current.pairLocked && <span className="result-locked"><Lock size={12} aria-hidden/> según acta SNP</span>}</legend>
          {[1, 2, 3, 4, 5].map(n => <label key={n} className={pair === n ? "is-active" : ""}><input type="radio" name="pair" value={n} checked={pair === n} onChange={() => setPair(n)}/>{n}</label>)}
        </fieldset>
        <div className="result-grid" role="group" aria-label="Sets">
          <span/>{[1, 2, 3].map(s => <span key={s} className="result-grid-head">Set {s}</span>)}
          {["Nosotros", "Rivales"].map((label, side) => <div key={label} className="result-grid-row"><span className="result-grid-label">{label}</span>{[0, 1, 2].map(set => <input key={set} inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label={`${label}, set ${set + 1}`} disabled={set === 2 && firstTwoDecided} value={set === 2 && firstTwoDecided ? "" : cells[set][side]} onChange={e => setCells(c => c.map((row, i) => i === set ? row.map((v, j) => j === side ? e.target.value.replace(/\D/g, "") : v) : row))}/>)}</div>)}
        </div>
        {message && <p role="alert" className="snp-warning">{message}</p>}
        {existing && <div className="result-existing"><p>Registrado: {existing.map(s => s.join("-")).join(" · ")}</p><button type="button" className="button" disabled={busy} onClick={() => void send("confirm")}>Es mi partido</button></div>}
        <div className="result-actions"><button className="button" disabled={busy}>Guardar resultado</button><button type="button" className="button secondary" disabled={busy} onClick={() => void send("absent")}>No jugué</button></div>
      </form>
    </dialog>
  </>;
}
```

Notas para quien implemente:
- Todos los hooks van antes del `if (!current) return null` (reglas de hooks de React).
- Si `formatDate` no existe con esa firma en `src/lib/format.ts`, usar la función de fecha que use `team-schedule.tsx`.

- [ ] **Step 2: Montar en `AppShell`**

En `src/components/app-shell.tsx`: importar `import { ResultReminder } from "./result-reminder";` y renderizar `{!access && <ResultReminder/>}` justo después de `<div className="page-content">{children}</div>`.

- [ ] **Step 3: Estilos**

Añadir al final de `src/app/globals.css`:

```css
.result-chip { position: fixed; right: 20px; bottom: 20px; z-index: 40; display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 999px; border: 1px solid var(--accent-line); background: var(--accent); color: var(--accent-ink); font-weight: 700; box-shadow: 0 8px 24px rgba(2, 8, 14, 0.45); cursor: pointer; }
.result-chip b { background: var(--accent-ink); color: var(--accent); border-radius: 999px; padding: 0 7px; font-size: 12px; }
.result-chip:hover { background: var(--accent-hover); }
dialog.result-dialog { position: fixed; inset: 0; margin: auto; border: 1px solid var(--line); border-radius: 14px; padding: 0; background: var(--panel); color: var(--ink); width: min(440px, calc(100vw - 32px)); }
dialog.result-dialog::backdrop { background: rgba(2, 8, 14, 0.55); backdrop-filter: blur(4px); }
.result-dialog-body { display: grid; gap: 18px; padding: 20px; }
.result-dialog-body header { display: flex; justify-content: space-between; gap: 12px; }
.result-dialog-body h2 { margin: 2px 0; font-size: 20px; }
.result-dialog-body header p { margin: 0; color: var(--muted); }
.result-eyebrow { color: var(--accent); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
.result-close { background: none; border: 0; color: var(--muted); cursor: pointer; align-self: start; }
.result-pairs { display: flex; gap: 8px; border: 0; padding: 0; margin: 0; }
.result-pairs legend { margin-bottom: 8px; font-weight: 700; display: flex; gap: 8px; align-items: center; }
.result-locked { color: var(--muted); font-weight: 400; font-size: 12px; display: inline-flex; gap: 4px; align-items: center; }
.result-pairs label { flex: 1; text-align: center; padding: 10px 0; border: 1px solid var(--line); border-radius: 8px; cursor: pointer; font-weight: 700; }
.result-pairs label.is-active { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
.result-pairs:disabled label { cursor: not-allowed; opacity: 0.8; }
.result-pairs input { position: absolute; opacity: 0; pointer-events: none; }
.result-pairs label:has(input:focus-visible) { outline: 3px solid var(--accent); }
.result-grid { display: grid; grid-template-columns: 90px repeat(3, 1fr); gap: 8px; align-items: center; }
.result-grid-row { display: contents; }
.result-grid-head { text-align: center; color: var(--muted); font-size: 12px; }
.result-grid-label { font-weight: 700; }
.result-grid input { width: 100%; text-align: center; font-size: 20px; padding: 10px 0; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); }
.result-grid input:disabled { opacity: 0.35; }
.result-existing { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.result-actions { display: flex; gap: 10px; flex-wrap: wrap; }
@media (max-width: 640px) { .result-chip { right: 16px; bottom: 16px; } .result-grid { grid-template-columns: 76px repeat(3, 1fr); } }
```

- [ ] **Step 4: Lint y tipos**

Run: `pnpm lint && pnpm typecheck`
Expected: sin errores.

- [ ] **Step 5: Prueba manual en la app**

Arrancar `pnpm dev`. Entrar con una cuenta de jugador cuya jornada de hace más de 2 h no tenga sets en SNP. Para forzarlo en desarrollo sin tocar el código, apuntar `SNP_CACHE_DIR` a una copia de la caché y editar el `match-<id>.json` de esa jornada dejando `games[].sets` vacíos. Comprobar:
1. El pop-up se abre solo la primera vez. Al recargar, solo aparece el chip.
2. La pareja aparece bloqueada si el acta tiene convocatoria.
3. Con 6-4 y 6-3, el set 3 se desactiva. Con 6-4 y 3-6, el set 3 es obligatorio.
4. «Guardar» cierra el pop-up y quita el chip. Lo mismo con «No jugué».
5. La cuenta del entrenador no ve chip.
6. En una ventana de 375 px de ancho, el chip no tapa el botón del menú (que está arriba a la izquierda).

Si en la Task 1 no hubo credenciales, hacer ahora la verificación del acta real.

- [ ] **Step 6: Commit**

```bash
git add src/components/result-reminder.tsx src/components/app-shell.tsx src/app/globals.css
git commit -m "feat: pop-up y aviso de resultado pendiente tras la jornada"
```

---

### Task 7: Panel del entrenador y documentación

**Files:**
- Create: `src/components/coach-results.tsx`
- Modify: `src/components/coach-dashboard.tsx:16` (insertar `<CoachResults/>` después de la sección «MVP del mes»)
- Create: `docs/resultados.md`

**Interfaces:**
- Consumes: `GET /api/results` → `{ teams: CoachTeamResults[] }`, `DELETE /api/results`.
- Produces: `<CoachResults />` sin props.

- [ ] **Step 1: Componente**

`src/components/coach-results.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import type { CoachTeamResults } from "@/lib/pending-results-service";
export function CoachResults() {
  const [teams, setTeams] = useState<CoachTeamResults[] | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { void fetch("/api/results", { cache: "no-store" }).then(r => r.json()).then(d => d.teams ? setTeams(d.teams) : setMessage(d.error || "No se pudieron cargar los resultados.")).catch(() => setMessage("No se pudieron cargar los resultados.")); }, []);
  async function remove(fixtureId: string, teamId: string, pairIndex: number) {
    if (!confirm(`¿Borrar el resultado de la pareja ${pairIndex}? Se volverá a pedir a los jugadores.`)) return;
    const response = await fetch("/api/results", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fixtureId, teamId, pairIndex }) });
    const data = await response.json(); if (data.teams) setTeams(data.teams); else setMessage(data.error || "No se pudo borrar.");
  }
  return <section className="panel account-card"><h2>Resultados enviados</h2><p>Lo que los jugadores han registrado en la última jornada, para completar el acta en SNP.</p>
    {teams?.map(team => <div key={team.teamId}><h3>Equipo {team.teamId.toUpperCase()}{team.fixture && ` · Jornada ${team.fixture.round} vs ${team.fixture.opponent}`}</h3>
      {!team.fixture ? <p>Sin jornada disputada.</p> : team.results.length === 0 ? <p>Nadie ha enviado resultado todavía.</p> :
        <ul className="coach-results">{team.results.map(r => <li key={r.pair_index}><b>Pareja {r.pair_index}</b><span>{r.sets.map(s => s.join("-")).join(" · ")}</span><small>{r.player_name}</small><button type="button" className="text-link" onClick={() => void remove(r.fixture_id, r.team_id, r.pair_index)}>Borrar</button></li>)}</ul>}
    </div>)}
    {message && <p role="alert" className="snp-warning">{message}</p>}
  </section>;
}
```

Añadir a `globals.css`:

```css
.coach-results { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.coach-results li { display: grid; grid-template-columns: auto 1fr auto auto; gap: 12px; align-items: center; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; }
.coach-results small { color: var(--muted); }
```

- [ ] **Step 2: Insertarlo en el panel**

En `src/components/coach-dashboard.tsx`, importar `import { CoachResults } from "./coach-results";` y colocar `<CoachResults/>` justo después del `</section>` de «MVP del mes». Actualizar el texto de `PageHeading` a: `"Gestiona posiciones, alineaciones privadas, MVP y resultados enviados por los jugadores."`

- [ ] **Step 3: Documentación**

`docs/resultados.md`:

```markdown
# Resultados pendientes

## Activación

Ejecutar `supabase/match-results.sql` en el SQL Editor de Supabase. Es repetible. No hay variables nuevas.

## Flujo

Dos horas después del inicio de la última jornada de A o B, la app consulta el acta SNP de ese enfrentamiento para cada jugador con cuenta:

- Si el jugador aparece con sets publicados, o la convocatoria no le incluye, no se le pide nada.
- Si está convocado sin sets, se le pide el resultado con su número de pareja fijado.
- Si el acta no tiene convocatoria, elige la pareja (1 a 5) o pulsa «No jugué».

El pop-up se abre una vez por jornada y dispositivo. Después queda un aviso en la esquina inferior derecha. Si un compañero ya registró la misma pareja, el pendiente desaparece. Sin pareja fijada, el jugador puede confirmar «Es mi partido».

El entrenador ve en `/entrenador` lo enviado en la última jornada y puede borrar un resultado para que se vuelva a pedir.

## Límites

La app no escribe en SNP: el capitán sigue completando el acta en SNP. Un fallo de SNP no crea avisos. Se reintenta al cambiar de sección. Los resultados no se pueden editar. Un resultado erróneo se borra desde el panel del entrenador.
```

- [ ] **Step 4: Verificación completa**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: todo en verde. Después, prueba manual: entrar como `fitoraya`, ver «Resultados enviados» con el resultado de la Task 6 y borrarlo. Entrar de nuevo como jugador y comprobar que vuelve el chip.

- [ ] **Step 5: Commit**

```bash
git add src/components/coach-results.tsx src/components/coach-dashboard.tsx src/app/globals.css docs/resultados.md
git commit -m "feat: resultados enviados en el panel del entrenador y documentación"
```

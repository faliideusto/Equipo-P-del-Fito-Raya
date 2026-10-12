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
test("contexto: el lugar del acta solo se busca para el próximo partido fuera de casa", async () => {
  const away = { ...fixture("60", 6, "2026-10-25T08:00:00.000Z", "pending"), home: false };
  const asked: string[] = [];
  const placeOf = async (f: Fixture) => { asked.push(f.id); return "PADEL CUBIERTO ARCOS SL"; };
  const ctx = await teamContext("a", [player("a-1", "1")], [away], memoryWalletStore(), Date.parse("2026-10-11T00:00:00Z"), async () => null, placeOf);
  assert.equal(ctx.next?.place, "PADEL CUBIERTO ARCOS SL");
  const home = await teamContext("a", [player("a-1", "1")], [fixture("61", 6, "2026-10-25T08:00:00.000Z", "pending")], memoryWalletStore(), Date.parse("2026-10-11T00:00:00Z"), async () => null, placeOf);
  assert.equal(home.next?.place, null);
  assert.deepEqual(asked, ["60"]);
  const failing = await teamContext("a", [player("a-1", "1")], [away], memoryWalletStore(), Date.parse("2026-10-11T00:00:00Z"), async () => null, async () => { throw new Error("SNP"); });
  assert.equal(failing.next?.place, null);
});

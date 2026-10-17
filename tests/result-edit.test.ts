import test from "node:test";
import assert from "node:assert/strict";
import { myResult } from "../src/domain/result-edit";
import type { SnpMatch } from "../src/domain/snp";

const player = (id: string) => ({ id, name: id, photoUrl: null });
const acta = (games: { home: string[]; sets?: [number, number][] }[]): SnpMatch => ({ id: "1", title: "", dateLabel: "", teams: ["Fito A", "Rival"], teamIds: ["7778", "3349"], score: null, games: games.map((g, index) => ({ index, homePlayers: g.home, awayPlayers: ["r1", "r2"], home: g.home.map(player), away: [player("r1"), player("r2")], sets: g.sets ?? [] })) });
const convoked = acta([{ home: ["10", "11"] }, { home: ["12", "13"] }]);
const saved = { pairIndex: 2, sets: [[6, 4], [6, 3]] as [number, number][], submittedBy: "u-partner" };
const base = { userId: "u-me", playerId: "13", confirmedPair: null, acta: convoked, ownSnpTeamId: "7778", home: true };

test("el compañero convocado en la pareja ve y puede modificar el resultado", () => {
  assert.deepEqual(myResult({ ...base, results: [saved] }), { ...saved, editable: true });
});
test("quien lo envió puede modificarlo aunque el acta no tenga convocatoria", () => {
  const noLineup = acta([]);
  assert.deepEqual(myResult({ ...base, playerId: "99", acta: noLineup, results: [{ ...saved, submittedBy: "u-me" }] }), { ...saved, submittedBy: "u-me", editable: true });
});
test("quien confirmó «Es mi partido» también puede modificarlo", () => {
  assert.equal(myResult({ ...base, playerId: "99", acta: acta([]), confirmedPair: 2, results: [saved] })?.editable, true);
});
test("un jugador de otra pareja no ve ese resultado como suyo", () => {
  assert.equal(myResult({ ...base, playerId: "10", results: [saved] }), null);
  assert.equal(myResult({ ...base, playerId: "99", acta: null, results: [saved] }), null);
});
test("cuando SNP publica los sets de esa pareja ya no se puede modificar", () => {
  const published = acta([{ home: ["10", "11"] }, { home: ["12", "13"], sets: [[6, 4], [6, 3]] }]);
  assert.equal(myResult({ ...base, acta: published, results: [saved] })?.editable, false);
});
test("sin resultado guardado no hay nada que mostrar", () => {
  assert.equal(myResult({ ...base, results: [] }), null);
});
test("el resultado provisional se coloca en las filas local y visitante del acta", async () => {
  const { toActaSets } = await import("../src/domain/result-edit");
  assert.deepEqual(toActaSets([[6, 4], [3, 6], [10, 8]], 0), [[6, 4], [3, 6], [10, 8]]);
  assert.deepEqual(toActaSets([[6, 4], [3, 6], [10, 8]], 1), [[4, 6], [6, 3], [8, 10]]);
});

test("entrenador y capitanes pueden corregir cualquier pareja una hora después del inicio", async () => {
  const { managedEditablePairs } = await import("../src/domain/result-edit");
  const hour = 3600_000; const start = Date.parse("2026-10-10T18:00:00Z");
  assert.deepEqual(managedEditablePairs({ acta: convoked, start, now: start + hour, delay: hour }), [1, 2, 3, 4, 5]);
  assert.deepEqual(managedEditablePairs({ acta: convoked, start, now: start + hour - 1, delay: hour }), []);
  assert.deepEqual(managedEditablePairs({ acta: convoked, start: null, now: start + hour, delay: hour }), []);
  const published = acta([{ home: ["10", "11"], sets: [[6, 4], [6, 3]] }, { home: ["12", "13"] }]);
  assert.deepEqual(managedEditablePairs({ acta: published, start, now: start + hour, delay: hour }), [2, 3, 4, 5]);
});

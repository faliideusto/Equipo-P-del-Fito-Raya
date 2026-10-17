import { test } from "node:test";
import assert from "node:assert/strict";
import { actaHasLineup, provisionalActa } from "../src/domain/provisional-acta";
import { seasonRanking } from "../src/domain/season-ranking";
import type { SnpMatch } from "../src/domain/snp";
import type { Player } from "../src/domain/types";

// Acta of today's away match: SNP has the sets of pair 1 only and no players yet.
const acta: SnpMatch = { id: "55266", title: "FASE REGULAR - Future - 2ª División [Jornada 3]", dateLabel: "", teams: ["Arcos", "Fito A"], teamIds: ["3349", "7778"], score: [0, 0],
  games: [0, 1, 2, 3, 4].map(index => ({ index, homePlayers: [], awayPlayers: [], home: [], away: [], sets: index === 0 ? [[6, 2], [7, 5]] as [number, number][] : [] })) };
const player = (id: string, name: string): Player => ({ id: `a-${id}`, sourceId: id, name, teamId: "a", points: 1000, position: null });

test("completa el acta con los resultados y la convocatoria de la app mientras SNP no la publica", () => {
  assert.equal(actaHasLineup(acta, 1), false);
  const match = provisionalActa({ acta, ownSide: 1, appResults: { 1: [[0, 6], [0, 6]], 2: [[6, 3], [6, 4]] }, lineup: { 1: [{ id: "1", name: "Uno" }, { id: "2", name: "Dos" }], 2: [{ id: "3", name: "Tres" }, { id: "4", name: "Cuatro" }] } });
  // SNP sets win over the app ones; the app result is turned to the acta side (away = second).
  assert.deepEqual(match.games[0].sets, [[6, 2], [7, 5]]);
  assert.deepEqual(match.games[1].sets, [[3, 6], [4, 6]]);
  assert.deepEqual(match.games[1].away?.map(p => p.id), ["3", "4"]);
  assert.deepEqual(match.games[2].sets, []);
  const { rows } = seasonRanking([player("1", "Uno"), player("2", "Dos"), player("3", "Tres"), player("4", "Cuatro")], [{ match, side: 1 }]);
  const points = Object.fromEntries(rows.map(r => [r.player.sourceId, [r.points, r.played, r.won]]));
  assert.deepEqual(points, { "1": [0, 1, 0], "2": [0, 1, 0], "3": [3, 1, 1], "4": [3, 1, 1] });
});
test("cuando SNP publica la convocatoria manda SNP", () => {
  const published: SnpMatch = { ...acta, games: acta.games.map(g => ({ ...g, away: [{ id: "9", name: "Nueve", photoUrl: null }, { id: "8", name: "Ocho", photoUrl: null }] })) };
  assert.equal(actaHasLineup(published, 1), true);
  const match = provisionalActa({ acta: published, ownSide: 1, appResults: {}, lineup: { 1: [{ id: "1", name: "Uno" }] } });
  assert.deepEqual(match.games[0].away?.map(p => p.id), ["9", "8"]);
});
test("solo se completan las jornadas jugadas que SNP no ha cerrado", async () => {
  const { unpublishedFixtures } = await import("../src/lib/provisional-results");
  const base = { teamId: "a" as const, opponent: "X", venue: "", home: true, status: "pending" as const, matches: [] };
  const now = Date.parse("2026-10-17T12:00:00Z");
  const fixtures = [
    { ...base, id: "1", round: 1, date: "2026-10-03T08:00:00.000Z", score: [5, 7] as [number, number] },
    { ...base, id: "3", round: 3, date: "2026-10-17T08:00:00.000Z", score: undefined },
    { ...base, id: "4", round: 4, date: "2026-10-17T11:30:00.000Z", score: undefined },
    { ...base, id: "5", round: 5, date: "2026-10-24T08:00:00.000Z", score: undefined },
  ];
  assert.deepEqual(unpublishedFixtures(fixtures, now).map(f => f.id), ["3"]);
});
test("marcador provisional local–visitante con los partidos ya decididos", async () => {
  const { actaScore } = await import("../src/domain/provisional-acta");
  assert.equal(actaScore(acta.games.length ? { ...acta, games: acta.games.map(g => ({ ...g, sets: [] })) } : acta), null);
  // Away team: app results are ours first; the acta is home first.
  const match = provisionalActa({ acta, ownSide: 1, appResults: { 2: [[0, 6], [0, 6]], 3: [[6, 2], [6, 3]], 4: [[3, 6], [3, 6]], 5: [[4, 6], [6, 2], [6, 2]] }, lineup: {} });
  // Pair 1 (3) and 2 (3) and 4 (2) for home; 3 (2) and 5 (2) for us.
  assert.deepEqual(actaScore(match), [8, 4]);
});
test("sin acta de SNP cuentan solo los resultados de la app", async () => {
  const { emptyActa, actaScore } = await import("../src/domain/provisional-acta");
  const all = { 1: [[2, 6], [5, 7]], 2: [[0, 6], [0, 6]], 3: [[6, 2], [6, 3]], 4: [[3, 6], [3, 6]], 5: [[4, 6], [6, 2], [6, 2]] } as Record<number, [number, number][]>;
  const match = provisionalActa({ acta: emptyActa("55266"), ownSide: 1, appResults: all, lineup: { 3: [{ id: "320953", name: "Javier" }] } });
  assert.deepEqual(actaScore(match), [8, 4]);
  assert.deepEqual(match.games[2].away?.map(p => p.id), ["320953"]);
});

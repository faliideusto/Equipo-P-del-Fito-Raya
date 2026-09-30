import { test } from "node:test";
import assert from "node:assert/strict";
import { seasonRanking } from "../src/domain/season-ranking";
import type { Player } from "../src/domain/types";
import type { SnpMatch } from "../src/domain/snp";

const players: Player[] = ["1", "2"].map(id => ({ id: `a-${id}`, sourceId: id, name: `Jugador ${id}`, teamId: "a", points: 0, position: null }));
const match: SnpMatch = { id: "10", title: "", dateLabel: "", teams: ["Rival", "Fito"], score: [0, 3], games: [{ index: 0, homePlayers: ["Rival 1", "Rival 2"], awayPlayers: players.map(p => p.name), away: players.map(p => ({ id: p.sourceId!, name: p.name, photoUrl: null })), sets: [[2, 6], [6, 4], [3, 6]] }] };

test("Visitor victory credits full team points to both players and deduplicates actas", () => {
  const { rows } = seasonRanking(players, [{ match, side: 1 }, { match, side: 1 }]);
  for (const row of rows) assert.deepEqual([row.played, row.won, row.lost, row.setsWon, row.setsLost, row.points], [1, 1, 0, 2, 1, 3]);
});
test("Loss counts sets without points; unresolved games do not count", () => {
  const loss = { ...match, games: [{ ...match.games[0], index: 4, sets: [[6, 2], [6, 3]] as [number, number][] }] };
  const pending = { ...match, id: "11", games: [{ ...match.games[0], sets: [[0, 0]] as [number, number][] }] };
  const { rows } = seasonRanking(players, [{ match: loss, side: 1 }, { match: pending, side: 1 }]);
  for (const row of rows) assert.deepEqual([row.played, row.won, row.lost, row.setsWon, row.setsLost, row.points], [1, 0, 1, 0, 2, 0]);
});
test("Different team roster never inherits another team's statistics", () => {
  const other = players.map(p => ({ ...p, sourceId: `b${p.sourceId}` }));
  const { rows, unassigned } = seasonRanking(other, [{ match, side: 1 }]);
  assert.equal(unassigned, 2);
  assert.ok(rows.every(row => row.points === 0 && row.played === 0));
});

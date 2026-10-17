import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEncounters, encounterResult } from "../src/domain/provisional-standings";
import type { SnpMatch } from "../src/domain/snp";

const acta = (sets: [number, number][][]): SnpMatch => ({ id: "1", title: "", dateLabel: "", teams: ["L", "V"], score: null, games: sets.map((s, index) => ({ index, homePlayers: [], awayPlayers: [], sets: s })) });

test("un enfrentamiento solo cuenta con los cinco partidos decididos", () => {
  assert.equal(encounterResult("1", "2", acta([[[6, 2], [6, 3]]])), null);
  assert.equal(encounterResult("1", "2", acta([[[6, 2], [6, 3]], [[6, 2]], [[2, 6], [2, 6]], [[6, 0], [6, 0]], [[6, 0], [6, 0]]])), null);
});
test("aplica la J3 de ayer del A como SNP: puntos, empates por sets y diferencia de juegos", () => {
  // Arcos (local) – Fito A: SNP sets of 55266.
  const j3 = encounterResult("3349", "7778", acta([[[6, 2], [7, 5]], [[6, 0], [6, 0]], [[2, 6], [3, 6]], [[6, 3], [6, 2]], [[6, 4], [3, 6], [2, 6]]]))!;
  assert.deepEqual(j3, { homeId: "3349", awayId: "7778", points: [8, 4], sets: [7, 4], games: [53, 40] });
  const table = applyEncounters([
    { teamId: "7778", played: 2, won: 2, lost: 0, points: 16, gameDifference: 18 },
    { teamId: "3349", played: 1, won: 1, lost: 0, points: 12, gameDifference: 26 },
  ], [j3]);
  assert.deepEqual(table, [
    { teamId: "3349", played: 2, won: 2, lost: 0, points: 20, gameDifference: 39 },
    { teamId: "7778", played: 3, won: 2, lost: 1, points: 20, gameDifference: 5 },
  ]);
  // 6-6 in points: the side with more sets wins (J1 of A, 7-5 in sets).
  const tie = applyEncounters([{ teamId: "a", played: 0, won: 0, lost: 0, points: 0, gameDifference: 0 }, { teamId: "b", played: 0, won: 0, lost: 0, points: 0, gameDifference: 0 }], [{ homeId: "a", awayId: "b", points: [6, 6], sets: [7, 5], games: [59, 57] }]);
  assert.deepEqual(tie.map(r => [r.teamId, r.won, r.lost, r.gameDifference]), [["a", 1, 0, 2], ["b", 0, 1, -2]]);
});

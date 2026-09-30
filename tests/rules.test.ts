import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assignPlayer,
  createPair,
  compatible,
  duplicatePlayers,
  emptyLineup,
  fixtureScore,
  matchPoints,
  matchValue,
  pairPoints,
  removePlayer,
  sortPairs,
} from "../src/domain/rules";
import type { Match, Player } from "../src/domain/types";
const players: Player[] = [
  { id: "a1", name: "Uno", points: 340, position: "RIGHT", teamId: "a" },
  { id: "a2", name: "Dos", points: 280, position: "LEFT", teamId: "a" },
  { id: "a3", name: "Tres", points: 900, position: "BOTH", teamId: "a" },
  {
    id: "b1",
    name: "Otro equipo",
    points: 1500,
    position: "LEFT",
    teamId: "b",
  },
];
test("crea una pareja con dos jugadores libres sin reemplazar parejas ni duplicar", () => {
  const original = emptyLineup();
  const selected = ["a1", "a2", "a3", "b1"];
  const next = createPair(original, "a1", "a2", players, selected, "a");
  assert.deepEqual(next[0].players, ["a1", "a2"]);
  assert.deepEqual(original[0].players, [null, null]);
  assert.equal(createPair(next, "a1", "a3", players, selected, "a"), next);
  assert.equal(createPair(original, "a1", "a1", players, selected, "a"), original);
  assert.equal(createPair(original, "a1", "b1", players, selected, "a"), original);
  assert.equal(createPair(original, "a1", "a2", players, ["a1"], "a"), original);
  const partial = assignPlayer(original, "a3", "slot-0", 0, players, selected, "a");
  const withNewPair = createPair(partial, "a1", "a2", players, selected, "a");
  assert.deepEqual(withNewPair[0].players, ["a3", null]);
  assert.deepEqual(withNewPair[1].players, ["a1", "a2"]);
  const noEmpty = original.map((pair) => ({...pair, players: ["a3", null] as typeof pair.players}));
  assert.equal(createPair(noEmpty, "a1", "a2", players, selected, "a"), noEmpty);
});
test("suma puntos y ordena sin mutar; los empates son deterministas", () => {
  const pairs = emptyLineup();
  pairs[0].players = ["a1", "a2"];
  pairs[1].players = ["a3", null];
  assert.equal(pairPoints(pairs[0], players), 620);
  assert.equal(pairPoints(pairs[2], players), 0);
  assert.equal(sortPairs(pairs, players)[0].id, "slot-1");
  assert.equal(pairs[0].id, "slot-0");
  assert.deepEqual(
    sortPairs(emptyLineup().reverse(), players).map((p) => p.id),
    emptyLineup().map((p) => p.id),
  );
});
test("todas las compatibilidades de posición", () => {
  assert.equal(compatible(null, "RIGHT"), null);
  assert.equal(compatible("LEFT", null), null);
  for (const a of ["RIGHT", "LEFT", "BOTH"] as const)
    for (const b of ["RIGHT", "LEFT", "BOTH"] as const)
      assert.equal(compatible(a, b), a === "BOTH" || b === "BOTH" || a !== b);
});
test("valores 3/3/2/2/2 y resultado global 7-5", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(matchValue), [3, 3, 2, 2, 2]);
  const matches: Match[] = [true, false, true, false, true].map(
    (won, pairIndex) => ({
      pairIndex,
      playerIds: ["a1", "a2"],
      opponents: ["Rival", "Rival"],
      winner: won ? "home" : "away",
    }),
  );
  assert.deepEqual(fixtureScore(matches), { home: 7, away: 5 });
  assert.deepEqual(matchPoints(matches[1]), { home: 0, away: 3 });
  assert.throws(() => matchValue(5));
  assert.throws(() => matchValue(-1));
  assert.throws(() => fixtureScore(matches.slice(1)));
  assert.throws(() => fixtureScore([...matches.slice(0, 4), matches[0]]));
});
test("mueve e intercambia sin duplicar y sin mutar el estado anterior", () => {
  const original = emptyLineup();
  const selected = ["a1", "a2", "a3"];
  let pairs = assignPlayer(original, "a1", "slot-0", 0, players, selected, "a");
  pairs = assignPlayer(pairs, "a2", "slot-1", 1, players, selected, "a");
  pairs = assignPlayer(pairs, "a1", "slot-1", 1, players, selected, "a");
  assert.deepEqual(pairs[0].players, ["a2", null]);
  assert.deepEqual(pairs[1].players, [null, "a1"]);
  assert.deepEqual(duplicatePlayers(pairs), []);
  assert.deepEqual(original, emptyLineup());
  pairs = assignPlayer(pairs, "a1", "slot-1", 0, players, selected, "a");
  assert.deepEqual(pairs[1].players, ["a1", null]);
  assert.deepEqual(removePlayer(pairs, "a1")[1].players, [null, null]);
});
test("rechaza jugadores del otro equipo y no seleccionados", () => {
  const pairs = emptyLineup();
  assert.equal(
    assignPlayer(pairs, "b1", "slot-0", 0, players, ["b1"], "a"),
    pairs,
  );
  assert.equal(assignPlayer(pairs, "a1", "slot-0", 0, players, [], "a"), pairs);
  assert.equal(
    assignPlayer(pairs, "unknown", "slot-0", 0, players, ["unknown"], "a"),
    pairs,
  );
});
test("detecta IDs duplicados", () => {
  const pairs = emptyLineup();
  pairs[0].players = ["a1", "a2"];
  pairs[2].players = ["a1", null];
  assert.deepEqual(duplicatePlayers(pairs), ["a1"]);
});

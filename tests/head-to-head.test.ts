import test from "node:test";
import assert from "node:assert/strict";
import { completePairPoints, edgeOf, forecast, headToHead, orderedPairs } from "../src/domain/head-to-head";
import type { Pair } from "../src/domain/types";

const pairs = (...ids: (string | null)[]): Pair[] => Array.from({ length: 5 }, (_, i) => ({ id: `slot-${i}`, players: [ids[i * 2] ?? null, ids[i * 2 + 1] ?? null] }));
const own: Record<string, number> = { a1: 60, a2: 60, a3: 50, a4: 50, a5: 40, a6: 40, a7: 30, a8: 30, a9: 20, a10: 20 };
const rival: Record<string, number> = { r1: 70, r2: 70, r3: 51, r4: 50, r5: 30, r6: 30, r7: 30, r8: 30, r9: 10, r10: 10 };

test("los cruces enfrentan las parejas por orden de puntos SNP", () => {
  const matchups = headToHead(pairs("a9", "a10", "a1", "a2", "a5", "a6", "a3", "a4", "a7", "a8"), id => own[id], pairs("r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10"), id => rival[id]);
  assert.deepEqual(matchups.map(m => m.own?.players[0]), ["a1", "a3", "a5", "a7", "a9"]);
  assert.deepEqual(matchups.map(m => m.edge), ["rival", "even", "own", "even", "own"]);
  assert.deepEqual(matchups.map(m => m.value), [3, 3, 2, 2, 2]);
  assert.deepEqual(forecast(matchups), { own: 4, rival: 3, open: 5, verdict: "open" });
});

test("con siete puntos de favorito se da por ganado", () => {
  const matchups = headToHead(pairs("a1", "a2", "a3", "a4", "a5", "a6"), id => own[id], pairs("r5", "r6", "r7", "r8", "r9", "r10"), id => rival[id]);
  assert.equal(forecast(matchups).verdict, "own");
  assert.deepEqual(matchups.slice(3).map(m => m.edge), ["unknown", "unknown"]);
});

test("una pareja incompleta no suma ni se ordena delante", () => {
  assert.equal(completePairPoints({ id: "x", players: ["a1", null] }, id => own[id]), null);
  assert.equal(completePairPoints({ id: "x", players: ["a1", "zz"] }, id => own[id]), null);
  assert.equal(orderedPairs(pairs("a1", null, "a9", "a10"), id => own[id])[0].players[0], "a9");
  assert.equal(edgeOf(100, 95), "even");
  assert.equal(edgeOf(100, 94), "own");
  assert.equal(edgeOf(null, 94), "unknown");
});

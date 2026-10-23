import test from "node:test";
import assert from "node:assert/strict";
import { completePairPoints, edgeOf, forecast, headToHead, orderedPairs, pairWinRate } from "../src/domain/head-to-head";
import type { Pair } from "../src/domain/types";

const pairs = (...ids: (string | null)[]): Pair[] => Array.from({ length: 5 }, (_, i) => ({ id: `slot-${i}`, players: [ids[i * 2] ?? null, ids[i * 2 + 1] ?? null] }));
const own: Record<string, number> = { a1: 60, a2: 60, a3: 50, a4: 50, a5: 40, a6: 40, a7: 30, a8: 30, a9: 20, a10: 20 };
const rival: Record<string, number> = { r1: 70, r2: 70, r3: 51, r4: 50, r5: 30, r6: 30, r7: 30, r8: 30, r9: 10, r10: 10 };
// won out of 10 decided matches for every player.
const wins: Record<string, number> = { a1: 5, a2: 5, a3: 7, a4: 7, a5: 4, a6: 4, a7: 6, a8: 6, a9: 9, a10: 9, r1: 8, r2: 8, r3: 7, r4: 6, r5: 5, r6: 5, r7: 6, r8: 6, r9: 2, r10: 2 };
const rates = (id: string) => wins[id] === undefined ? null : { won: wins[id], decided: 10 };

test("los cruces siguen el orden SNP y el favorito sale del winrate de la pareja", () => {
  const matchups = headToHead(pairs("a9", "a10", "a1", "a2", "a5", "a6", "a3", "a4", "a7", "a8"), id => own[id], rates, pairs("r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10"), id => rival[id], rates);
  assert.deepEqual(matchups.map(m => m.own?.players[0]), ["a1", "a3", "a5", "a7", "a9"]);
  assert.deepEqual(matchups.map(m => m.ownRate), [50, 70, 40, 60, 90]);
  assert.deepEqual(matchups.map(m => m.rivalRate), [80, 65, 50, 60, 20]);
  assert.deepEqual(matchups.map(m => m.edge), ["rival", "even", "rival", "even", "own"]);
  assert.deepEqual(forecast(matchups), { own: 2, rival: 5, open: 5, verdict: "open" });
});

test("con siete puntos de favorito se da por ganado y sin winrate el cruce queda abierto", () => {
  const weak = () => ({ won: 1, decided: 10 });
  const matchups = headToHead(pairs("a3", "a4", "a9", "a10", "a7", "a8"), id => own[id], rates, pairs("r9", "r10", "r5", "r6", "r7", "r8"), id => rival[id], weak);
  assert.deepEqual(matchups.map(m => m.edge), ["own", "own", "own", "unknown", "unknown"]);
  assert.equal(forecast(matchups).verdict, "own");
  const loading = headToHead(pairs("a1", "a2"), id => own[id], () => null, pairs("r1", "r2"), id => rival[id], rates);
  assert.equal(loading[0].edge, "unknown");
  assert.equal(loading[0].ownPoints, 120);
});

test("una pareja incompleta no suma ni se ordena delante, y el winrate se pondera por partidos", () => {
  assert.equal(completePairPoints({ id: "x", players: ["a1", null] }, id => own[id]), null);
  assert.equal(completePairPoints({ id: "x", players: ["a1", "zz"] }, id => own[id]), null);
  assert.equal(orderedPairs(pairs("a1", null, "a9", "a10"), id => own[id])[0].players[0], "a9");
  assert.equal(pairWinRate({ id: "x", players: ["p", "q"] }, id => id === "p" ? { won: 9, decided: 10 } : { won: 0, decided: 30 }), 22.5);
  assert.equal(pairWinRate({ id: "x", players: ["p", "q"] }, () => ({ won: 0, decided: 0 })), null);
  assert.equal(edgeOf(60, 55), "even");
  assert.equal(edgeOf(60, 54.9), "own");
  assert.equal(edgeOf(null, 50), "unknown");
});

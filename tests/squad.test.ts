import { test } from "node:test";
import assert from "node:assert/strict";
import { compactPoints, pointsTier, squadLayout } from "../src/domain/squad";

test("Top ten form the five match-day pairs in ranking order; the rest are substitutes", () => {
  const { pairs, bench } = squadLayout(Array.from({ length: 12 }, (_, i) => i + 1));
  assert.deepEqual(pairs.map(pair => pair.players), [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]]);
  assert.deepEqual(pairs.map(pair => pair.value), [3, 3, 2, 2, 2]);
  assert.deepEqual(bench, [11, 12]);
});
test("Substitutes keep their own order, left to right", () => {
  const points = [5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 10, 30, 20];
  const { bench } = squadLayout(points.map((p, i) => ({ id: i, p })), (a, b) => b.p - a.p);
  assert.deepEqual(bench.map(row => row.p), [30, 20, 10]);
});
test("Short rosters leave the last pairs empty", () => {
  const { pairs, bench } = squadLayout([1, 2, 3]);
  assert.deepEqual(pairs.map(pair => pair.players), [[1, 2], [3]]);
  assert.deepEqual(bench, []);
});
test("SNP points are shortened for the card rating", () => {
  assert.equal(compactPoints(62421.88), "62,4K");
  assert.equal(compactPoints(0), "0");
  assert.equal(compactPoints(null), "—");
});
test("Card tier follows SNP points: gold 45k+, silver 30k+, bronze below", () => {
  assert.deepEqual([62421.88, 45000, 44999, 30000, 29999, 0, null].map(pointsTier), ["gold", "gold", "silver", "silver", "bronze", "bronze", "bronze"]);
});

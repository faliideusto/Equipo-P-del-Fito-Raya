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
test("el set 3 se bloquea y se ignora cuando los dos primeros dan ganador", async () => {
  const { visibleCells } = await import("../src/domain/match-result");
  assert.deepEqual(visibleCells([["6", "4"], ["6", "3"], ["2", "6"]]), { cells: [["6", "4"], ["6", "3"], ["", ""]], thirdLocked: true });
  assert.deepEqual(visibleCells([["6", "4"], ["3", "6"], ["7", "5"]]), { cells: [["6", "4"], ["3", "6"], ["7", "5"]], thirdLocked: false });
  assert.equal(visibleCells([["6", ""], ["6", "3"], ["", ""]]).thirdLocked, false);
});

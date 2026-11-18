import test from "node:test";
import assert from "node:assert/strict";
import { byRound } from "../src/domain/rounds";

test("los retos se ordenan entre la primera y la segunda fase", () => {
  assert.deepEqual([6, 1000, 5, 11, 1].map(round => ({ round })).sort(byRound).map(f => f.round), [1, 5, 1000, 6, 11]);
});

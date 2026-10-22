import { test } from "node:test";
import assert from "node:assert/strict";
import { playerWinRate, playerWinRates } from "../src/domain/player-winrate";
import { normalizePlayerStats } from "../src/lib/snp-parser";

test("winrate weights matches across phases instead of averaging percentages", () => {
  assert.deepEqual(playerWinRate([{ won: 1, lost: 0 }, { won: 1, lost: 3 }]), {
    won: 2, lost: 3, decided: 5, percentage: 40,
  });
});

test("winrate separates the current season from the available history, including challenges", () => {
  const current = normalizePlayerStats({ regular: { J: { 1: { pd: 2, p3p_g2s: 1, p2p_p3s: 1 }, 2: { pd: 1 } } } });
  const previous = normalizePlayerStats({ playoff: { J: { 1: { pd: 1, p3p_p2s: 1 }, retos: { pd: 1, p2p_g3s: 1 } } } });
  const rates = playerWinRates(current, previous);
  assert.deepEqual(rates.current, { won: 1, lost: 1, decided: 2, percentage: 50, setsWon: 3, setsLost: 2 });
  assert.deepEqual(rates.total, { won: 2, lost: 2, decided: 4, percentage: 50, setsWon: 5, setsLost: 5 });
});

test("winrate distinguishes no results from zero wins", () => {
  assert.equal(playerWinRate([]).percentage, null);
  assert.equal(playerWinRate([{ won: 0, lost: 0 }]).percentage, null);
  assert.equal(playerWinRate([{ won: 0, lost: 2 }]).percentage, 0);
  assert.equal(playerWinRate([{ won: 2, lost: 0 }]).percentage, 100);
});

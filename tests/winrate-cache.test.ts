import { test } from "node:test";
import assert from "node:assert/strict";
import { reusableWinRates, winRateFingerprint, WINRATE_MAX_AGE } from "../src/lib/winrate-cache";

const stats = [{ phase: "Liga", played: 4, won: 3, lost: 1, setsWon: 6, setsLost: 3, jornadas: [] }];
const profile = { groups: [{ id: "20", name: "Grupo" }], group: "20", points: 50000, stats, previousStats: [] };
const winRates = { current: { won: 3, lost: 1, decided: 4, percentage: 75 }, total: { won: 3, lost: 1, decided: 4, percentage: 75 } };
const now = Date.parse("2026-10-11T12:00:00Z");

test("Stored winrate is reused while the player's data is unchanged", () => {
  const fingerprint = winRateFingerprint(profile);
  assert.deepEqual(reusableWinRates({ fingerprint, winRates, savedAt: new Date(now - 3600000).toISOString() }, fingerprint, now), winRates);
});
test("A new result, new points or a new group forces a recalculation", () => {
  const stored = { fingerprint: winRateFingerprint(profile), winRates, savedAt: new Date(now).toISOString() };
  for (const changed of [{ ...profile, stats: [{ ...stats[0], played: 5, won: 4 }] }, { ...profile, points: 51000 }, { ...profile, groups: [...profile.groups, { id: "30", name: "Otro" }] }])
    assert.equal(reusableWinRates(stored, winRateFingerprint(changed), now), undefined);
});
test("Unchanged data is still recalculated once a day, for matches in other groups", () => {
  const fingerprint = winRateFingerprint(profile);
  assert.equal(reusableWinRates({ fingerprint, winRates, savedAt: new Date(now - WINRATE_MAX_AGE).toISOString() }, fingerprint, now), undefined);
  assert.equal(reusableWinRates(undefined, fingerprint, now), undefined);
});

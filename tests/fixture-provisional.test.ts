import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fixtureProvisional } from "../src/lib/pending-results-service";
import { saveResult } from "../src/lib/match-results";
import type { Fixture } from "../src/domain/types";
import type { SnpMatch } from "../src/domain/snp";

test("el capitán ve las parejas vacías además de su resultado; los jugadores solo el suyo", async () => {
  const keys = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "RENDER", "VERCEL"] as const;
  const env = keys.map(key => process.env[key]);
  const cwd = process.cwd();
  const dir = await mkdtemp(path.join(tmpdir(), "fito-captain-results-"));
  keys.forEach(key => { delete process.env[key]; });
  process.chdir(dir);
  try {
    const fixture: Fixture = { id: "55", teamId: "a", round: 1, opponent: "Rival", date: "2020-01-01T12:00:00Z", venue: "", home: false, status: "pending", matches: [] };
    const acta: SnpMatch = { id: "55", title: "", dateLabel: "", teams: ["Rival", "FITO RAYA"], teamIds: ["3349", "7778"], score: null, games: Array.from({ length: 5 }, (_, index) => ({ index, homePlayers: [], awayPlayers: [], sets: [] })) };
    const get = (manager: boolean, user: string | null = "captain", player: string | null = "13") => fixtureProvisional(user, player, "a", fixture, acta, manager);

    // No player has submitted anything yet: captains can fill in all five pairs.
    assert.deepEqual((await get(true)).editablePairs, [1, 2, 3, 4, 5]);
    assert.deepEqual((await get(false)).editablePairs, []);
    assert.deepEqual((await get(false, null, null)).editablePairs, []);
    assert.deepEqual((await get(true, null, null)).editablePairs, []);

    await saveResult({ fixture_id: "55", team_id: "a", pair_index: 1, sets: [[2, 6], [5, 7]], player_id: "13", submitted_by: "captain", created_at: fixture.date });
    await saveResult({ fixture_id: "55", team_id: "b", pair_index: 2, sets: [[6, 0], [6, 0]], player_id: "99", submitted_by: "other", created_at: fixture.date });
    const captain = await get(true);
    assert.deepEqual(captain.editablePairs, [1, 2, 3, 4, 5]);
    assert.deepEqual(captain.results, { 1: [[2, 6], [5, 7]] });
    assert.equal(captain.ownSide, 1);
    assert.deepEqual((await get(false)).editablePairs, [1]);
    assert.deepEqual((await get(true, null, null)).editablePairs, [1]);

    // SNP publication locks that pair even when the captain can enter other pairs.
    acta.games[1].sets = [[6, 4], [6, 3]];
    assert.deepEqual((await get(true)).editablePairs, [1, 3, 4, 5]);
    fixture.date = "2099-01-01T12:00:00Z";
    assert.deepEqual((await get(true)).editablePairs, []);
  } finally {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
    keys.forEach((key, i) => { if (env[i] === undefined) delete process.env[key]; else process.env[key] = env[i]; });
  }
});

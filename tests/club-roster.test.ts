import { test } from "node:test";
import assert from "node:assert/strict";
import { clubRoster, sharedPlayerIds, additionalPlayers } from "../src/data/club-roster";
import { snapshotTeams } from "../src/data/snp-explorer-snapshot";
import { assignPlayer, emptyLineup } from "../src/domain/rules";
test("registered position fills the roster and later coach changes still apply", () => {
  const roster = (positions: Record<string, "RIGHT" | "LEFT" | "BOTH" | null>) => clubRoster("a", snapshotTeams["7778"].players, [], positions, [], { "381423": "LEFT" });
  assert.equal(roster({}).find(p => p.sourceId === "381423")?.position, "LEFT");
  assert.equal(roster({ "a-381423": "RIGHT" }).find(p => p.sourceId === "381423")?.position, "RIGHT");
});

test("A includes shared B players with canonical positions and source profiles", () => {
  const a = clubRoster("a", snapshotTeams["7778"].players, snapshotTeams["803902"].players, { "b-249269": "LEFT" });
  assert.equal(a.length, snapshotTeams["7778"].players.length + 3);
  for (const id of sharedPlayerIds) {
    const player = a.find(p => p.sourceId === id)!;
    assert.equal(player.teamId, "a"); assert.equal(player.sourceTeamId, "803902"); assert.equal(player.id, id === "405856" ? "a-405856" : `b-${id}`);
  }
  assert.equal(a.find(p => p.id === "b-249269")?.position, "LEFT");
  const lineup = assignPlayer(emptyLineup(), "b-249269", emptyLineup()[0].id, 0, a, a.map(p => p.id), "a");
  assert.equal(lineup[0].players[0], "b-249269");
});
test("Shared players remain in B and do not duplicate when SNP also lists them in A", () => {
  const reserves = snapshotTeams["803902"].players;
  const a = clubRoster("a", [...snapshotTeams["7778"].players, reserves.find(p => p.id === "249269")!], reserves, {});
  assert.equal(a.filter(p => p.sourceId === "249269").length, 1);
  const b = clubRoster("b", reserves, [], {});
  assert.equal(b.length, reserves.length + 1);
  assert.ok(sharedPlayerIds.every(id => b.some(p => p.sourceId === id)));
});

test("David remains available in A and B with his existing lineup ID and shared position", () => {
  const david = snapshotTeams["7778"].players.find(p => p.id === "405856")!;
  const reserves = [...snapshotTeams["803902"].players, david];
  const ownA = snapshotTeams["7778"].players.filter(p => p.id !== david.id);
  const a = clubRoster("a", ownA, reserves, { "a-405856": "RIGHT" });
  const b = clubRoster("b", reserves, [], { "a-405856": "RIGHT" });
  for (const rows of [a, b]) {
    const players = rows.filter(p => p.sourceId === david.id);
    assert.equal(players.length, 1);
    assert.equal(players[0].id, "a-405856");
    assert.equal(players[0].sourceTeamId, "803902");
    assert.equal(players[0].position, "RIGHT");
  }
  const lineup = assignPlayer(emptyLineup(), "a-405856", emptyLineup()[0].id, 0, a, a.map(p => p.id), "a");
  assert.equal(lineup[0].players[0], "a-405856");
});
test("Daniel belongs only to A and Ruben is available in both with shared position and no duplicate registration", () => {
  const get = (team: "a" | "b") => clubRoster(team, snapshotTeams[team === "a" ? "7778" : "803902"].players, snapshotTeams["803902"].players, { "b-354270": "RIGHT" }, additionalPlayers.filter(p => p.teams.includes(team)));
  const a = get("a"); const b = get("b");
  assert.ok(a.some(p => p.sourceId === "249372")); assert.ok(!b.some(p => p.sourceId === "249372"));
  for (const rows of [a, b]) { assert.equal(rows.filter(p => p.sourceId === "354270").length, 1); assert.equal(rows.find(p => p.sourceId === "354270")?.position, "RIGHT"); }
  const registered = clubRoster("a", [additionalPlayers[0]], [], {}, additionalPlayers);
  assert.equal(registered.filter(p => p.sourceId === "249372").length, 1);
});

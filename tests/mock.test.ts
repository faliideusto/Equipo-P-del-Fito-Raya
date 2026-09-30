import { test } from "node:test";
import assert from "node:assert/strict";
import { players as savedPlayers,fixtures as savedFixtures,standings } from "../src/data/snp-snapshot";
import { fixtureScore, matchPoints } from "../src/domain/rules";
test("la captura de respaldo mantiene las plantillas y jornadas aisladas", () => {
  for (const id of ["a", "b"] as const) {
    const players = savedPlayers.filter(p=>p.teamId===id).sort((a,b)=>(b.points||0)-(a.points||0));
    const fixtures = savedFixtures.filter(f=>f.teamId===id);
    const rows = standings[id];
    assert.equal(players.length, 16);
    assert.ok(players.every((p) => p.teamId === id));
    assert.equal(new Set(players.map((p) => p.id)).size, 16);
    assert.ok(
      players.every(
        (p, i) => i === 0 || (p.points ?? -1) <= (players[i - 1].points ?? -1),
      ),
    );
    assert.ok(players.every((p) => p.points !== null && p.position === null));
    assert.equal(fixtures.length, id === "a" ? 10 : 8);
    assert.ok(fixtures.every((f) => f.date.includes("T")));
    assert.equal(
      players.filter((p) => p.points === 0).length,
      id === "a" ? 3 : 7,
    );
    let ownPoints = 0;
    for (const f of fixtures) {
      assert.equal(f.teamId, id);
      if (f.status === "pending") {
        assert.equal(f.matches.length, 0);
        continue;
      }
      const score = fixtureScore(f.matches);
      assert.equal(score.home + score.away, 12);
      ownPoints += f.home ? score.home : score.away;
      for (const match of f.matches) {
        assert.ok(
          match.playerIds.every((playerId) =>
            players.some((p) => p.id === playerId),
          ),
        );
        const points = matchPoints(match);
        assert.ok(points.home + points.away > 0);
      }
    }
    assert.equal(rows.find((r) => r.own)?.points, ownPoints);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { adjacentFixtures, latestStarted } from "../src/domain/fixture-navigation";
import type { Fixture, TeamId } from "../src/domain/types";

const fixture = (id: string, round: number, date: string, teamId: TeamId = "a"): Fixture => ({ id, teamId, round, opponent: "Rival", date, venue: "", home: true, status: "pending", matches: [] });

test("jornada anterior y siguiente dentro del calendario del equipo, por orden de jornada", () => {
  const list = [fixture("3", 3, "2026-10-17"), fixture("1", 1, "2026-09-26"), fixture("2", 2, "2026-10-03")];
  assert.deepEqual(Object.fromEntries(Object.entries(adjacentFixtures(list, "2")).map(([k, f]) => [k, f?.id ?? null])), { previous: "1", next: "3" });
  assert.equal(adjacentFixtures(list, "1").previous, null);
  assert.equal(adjacentFixtures(list, "3").next, null);
  assert.deepEqual(adjacentFixtures(list, "99"), { previous: null, next: null });
});
test("la última jornada disputada es la más reciente ya empezada de los equipos del usuario", () => {
  const a = [fixture("a2", 2, "2026-10-03T11:00:00.000Z"), fixture("a3", 3, "2026-10-17T11:00:00.000Z")];
  const b = [fixture("b2", 2, "2026-10-04T11:00:00.000Z", "b"), fixture("b3", 3, "2026-10-18T11:00:00.000Z", "b")];
  const now = Date.parse("2026-10-11T12:00:00Z");
  assert.deepEqual(summary(latestStarted([{ teamId: "a", fixtures: a }], now)), ["a", "a2"]);
  assert.deepEqual(summary(latestStarted([{ teamId: "a", fixtures: a }, { teamId: "b", fixtures: b }], now)), ["b", "b2"]);
  assert.deepEqual(summary(latestStarted([{ teamId: "a", fixtures: a }], Date.parse("2026-10-17T11:00:00.000Z"))), ["a", "a3"], "cuenta desde la hora de inicio, sin margen");
  assert.equal(latestStarted([{ teamId: "a", fixtures: a }], Date.parse("2026-09-01T00:00:00Z")), null);
});
test("si A y B empezaron a la vez gana el primer equipo de la lista", () => {
  const same = "2026-10-03T11:00:00.000Z";
  assert.deepEqual(summary(latestStarted([{ teamId: "a", fixtures: [fixture("a", 2, same)] }, { teamId: "b", fixtures: [fixture("b", 2, same, "b")] }], Date.parse("2026-10-11T00:00:00Z"))), ["a", "a"]);
});
function summary(value: ReturnType<typeof latestStarted>) { return value ? [value.teamId, value.fixture.id] : null; }

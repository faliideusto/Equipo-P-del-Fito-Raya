import test from "node:test";
import assert from "node:assert/strict";
import { devCaptainId, isTeamCaptain, type TeamCaptain } from "../src/domain/team-captain";
const captains: TeamCaptain[] = [{ team_id: "a", player_id: "10", updated_at: "" }];
test("el capitán guardado solo lo es de su equipo", () => {
  assert.equal(isTeamCaptain({ captains, teamId: "a", playerId: "10", onRoster: true, env: {} }), true);
  assert.equal(isTeamCaptain({ captains, teamId: "b", playerId: "10", onRoster: true, env: {} }), false);
  assert.equal(isTeamCaptain({ captains, teamId: "a", playerId: "11", onRoster: true, env: {} }), false);
});
test("DEV_CAPTAIN_PLAYER_ID solo en desarrollo y en su plantilla", () => {
  const dev = { DEV_CAPTAIN_PLAYER_ID: " 22 ", NODE_ENV: "development" };
  assert.equal(devCaptainId(dev), "22");
  assert.equal(isTeamCaptain({ captains: [], teamId: "b", playerId: "22", onRoster: true, env: dev }), true);
  assert.equal(isTeamCaptain({ captains: [], teamId: "b", playerId: "22", onRoster: false, env: dev }), false);
  assert.equal(devCaptainId({ ...dev, NODE_ENV: "production" }), null);
  assert.equal(devCaptainId({ ...dev, RENDER: "true" }), null);
  assert.equal(devCaptainId({ ...dev, VERCEL: "1" }), null);
  assert.equal(devCaptainId({ NODE_ENV: "development" }), null);
});

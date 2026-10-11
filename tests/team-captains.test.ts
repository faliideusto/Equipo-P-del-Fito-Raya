import test from "node:test";
import assert from "node:assert/strict";
import { isTeamCaptain, type TeamCaptain } from "../src/domain/team-captain";
const captains: TeamCaptain[] = [{ team_id: "a", player_id: "10", updated_at: "" }];
test("el capitán guardado solo lo es de su equipo", () => {
  assert.equal(isTeamCaptain({ captains, teamId: "a", playerId: "10" }), true);
  assert.equal(isTeamCaptain({ captains, teamId: "b", playerId: "10" }), false);
  assert.equal(isTeamCaptain({ captains, teamId: "a", playerId: "11" }), false);
  assert.equal(isTeamCaptain({ captains: [], teamId: "a", playerId: "10" }), false);
});

import type { TeamId } from "./types";
export type TeamCaptain = { team_id: TeamId; player_id: string; updated_at: string };
export function isTeamCaptain({ captains, teamId, playerId }: { captains: TeamCaptain[]; teamId: TeamId; playerId: string }) {
  return captains.some(c => c.team_id === teamId && c.player_id === playerId);
}

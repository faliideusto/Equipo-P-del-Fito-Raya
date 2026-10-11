import type { TeamId } from "./types";
export type TeamCaptain = { team_id: TeamId; player_id: string; updated_at: string };
type Env = Record<string, string | undefined>;
// Local testing only: never honoured on Render, Vercel or a production build.
export function devCaptainId(env: Env) {
  if (env.NODE_ENV === "production" || env.RENDER === "true" || env.VERCEL === "1") return null;
  return env.DEV_CAPTAIN_PLAYER_ID?.trim() || null;
}
export function isTeamCaptain({ captains, teamId, playerId, onRoster, env }: { captains: TeamCaptain[]; teamId: TeamId; playerId: string; onRoster: boolean; env: Env }) {
  return captains.some(c => c.team_id === teamId && c.player_id === playerId) || (onRoster && devCaptainId(env) === playerId);
}

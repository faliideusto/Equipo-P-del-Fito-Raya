import { playerLink } from "@/lib/account-profile";
import { walletTeams } from "@/lib/wallet-issue";
import { clubRepository } from "@/data/repository";
import type { Player, TeamId } from "@/domain/types";

type Deps = { link(userId: string): Promise<{ player_id: string } | null>; teams(playerId: string): Promise<TeamId[]>; players(): Promise<Player[]> };
const club: Deps = {
  link: userId => playerLink(userId),
  teams: playerId => walletTeams(playerId),
  players: async () => (await Promise.all([clubRepository.getPlayers("a"), clubRepository.getPlayers("b")])).flat(),
};
// Who is asking, for the prompt, and the team the chat starts on: the player's own, or both
// when they play in both, have no linked player or are the coach.
export async function chatIdentity(user: { id: string; role?: string }, deps: Deps = club): Promise<{ label: string; team: TeamId | null }> {
  if (user.role === "coach") return { label: "el entrenador del club", team: null };
  try {
    const link = await deps.link(user.id);
    if (link) {
      const [teams, players] = await Promise.all([deps.teams(link.player_id), deps.players()]);
      const player = players.find(p => p.id === link.player_id || p.sourceId === link.player_id);
      return { label: player ? `${player.name}, jugador del club` : "un jugador del club", team: teams.length === 1 ? teams[0] : null };
    }
  } catch { /* the name and team are a courtesy; the chat works without them */ }
  return { label: "un jugador del club", team: null };
}

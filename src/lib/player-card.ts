import { clubRepository } from "@/data/repository";
import { cardPhoto } from "@/data/player-photos";
import type { Player, Position } from "@/domain/types";

export type PlayerCardData = { name: string; photoUrl: string | null; snpPoints: number | null; snpRank: number | null; position: Position | null };

// The rank is the player's place in the team roster, which comes sorted by SNP points.
export function playerCardData(players: Player[], player: Player): PlayerCardData {
  return { name: player.name, photoUrl: cardPhoto(player), snpPoints: player.points, snpRank: player.points === null ? null : players.indexOf(player) + 1, position: player.position };
}

// Card of a club player by SNP id, from the first team that lists them (A before B), as in Mi perfil.
export async function clubPlayerCard(sourceId: string): Promise<PlayerCardData | null> {
  for (const teamId of ["a", "b"] as const) {
    const players = await clubRepository.getPlayers(teamId);
    const player = players.find(p => p.sourceId === sourceId);
    if (player) return playerCardData(players, player);
  }
  return null;
}

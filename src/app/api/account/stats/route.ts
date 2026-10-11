import { accountFailure, accountReply, AccountError, currentAccount } from "@/lib/account-auth";
import { playerLink } from "@/lib/account-profile";
import { clubRepository } from "@/data/repository";
import { loadSeasonRanking } from "@/lib/season-ranking-service";
import { cardPhoto } from "@/data/player-photos";
export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await currentAccount(); if (!user) throw new AccountError("Inicia sesión para ver tu perfil.", 401);
    if (user.role === "visitor") return accountReply({ teams: [] });
    const link = await playerLink(user.id); if (!link) return accountReply({ teams: [] });
    const teams = [];
    for (const teamId of ["a", "b"] as const) {
      const players = await clubRepository.getPlayers(teamId);
      const player = players.find(p => p.sourceId === link.player_id); if (!player) continue;
      const ranking = await loadSeasonRanking(teamId, players);
      const row = ranking.rows.find(r => r.player.id === player.id)!;
      teams.push({ id: teamId, name: player.name, photoUrl: cardPhoto(player), snpPoints: player.points, snpRank: player.points === null ? null : players.indexOf(player) + 1, position: player.position, rank: ranking.rows.indexOf(row) + 1, played: row.played, won: row.won, lost: row.lost, setsWon: row.setsWon, setsLost: row.setsLost, points: row.points, partial: ranking.unavailable > 0 || ranking.unassigned > 0, stale: ranking.saved > 0, acts: ranking.consulted });
    }
    return accountReply({ teams });
  } catch (error) { return accountFailure(error); }
}

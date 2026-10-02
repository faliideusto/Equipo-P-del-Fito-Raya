import { accountFailure, accountReply, AccountError, currentAccount } from "@/lib/account-auth";
import { playerLink } from "@/lib/account-profile";
import { clubRepository } from "@/data/repository";
import { getSnpMatch } from "@/lib/snp-service";
import { seasonRanking } from "@/domain/season-ranking";
import type { SnpMatch } from "@/domain/snp";
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
      const fixtures = (await clubRepository.getFixtures(teamId)).filter(f => f.score && f.score[0] + f.score[1] > 0);
      const matches: { match: SnpMatch; side: 0 | 1 }[] = []; let unavailable = 0; let stale = false;
      for (let i = 0; i < fixtures.length; i += 3) {
        const batch = fixtures.slice(i, i + 3);
        const results = await Promise.allSettled(batch.map(f => getSnpMatch(f.id)));
        results.forEach((result, index) => {
          if (result.status === "rejected" || !result.value.data.games.length) { unavailable++; return; }
          stale ||= result.value.stale;
          matches.push({ match: result.value.data, side: batch[index].home ? 0 : 1 });
        });
      }
      const ranking = seasonRanking(players, matches);
      const row = ranking.rows.find(r => r.player.id === player.id)!;
      teams.push({ id: teamId, position: player.position, rank: ranking.rows.indexOf(row) + 1, played: row.played, won: row.won, lost: row.lost, setsWon: row.setsWon, setsLost: row.setsLost, points: row.points, partial: unavailable > 0 || ranking.unassigned > 0, stale, acts: matches.length });
    }
    return accountReply({ teams });
  } catch (error) { return accountFailure(error); }
}

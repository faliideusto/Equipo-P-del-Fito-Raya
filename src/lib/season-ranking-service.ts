import { clubRepository } from "@/data/repository";
import { getSnpMatch } from "@/lib/snp-service";
import { seasonRanking } from "@/domain/season-ranking";
import type { SnpMatch } from "@/domain/snp";
import type { Player, TeamId } from "@/domain/types";

export async function loadSeasonRanking(teamId: TeamId, players?: Player[]) {
  const [roster, fixtures] = await Promise.all([players ?? clubRepository.getPlayers(teamId), clubRepository.getFixtures(teamId)]);
  const completed = fixtures.filter(f => f.score && f.score[0] + f.score[1] > 0);
  const matches: { match: SnpMatch; side: 0 | 1 }[] = [];
  let unavailable = 0; let saved = 0;
  for (let offset = 0; offset < completed.length; offset += 3) {
    const batch = completed.slice(offset, offset + 3);
    const results = await Promise.allSettled(batch.map(f => getSnpMatch(f.id)));
    results.forEach((result, i) => {
      if (result.status === "rejected" || !result.value.data.games.length) { unavailable++; return; }
      if (result.value.stale) saved++;
      matches.push({ match: result.value.data, side: batch[i].home ? 0 : 1 });
    });
  }
  const { rows, unassigned } = seasonRanking(roster, matches);
  return { rows, unassigned, unavailable, saved, consulted: matches.length, completed: completed.length };
}

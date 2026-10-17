import { clubRepository } from "@/data/repository";
import { getSnpMatch } from "@/lib/snp-service";
import { seasonRanking } from "@/domain/season-ranking";
import type { SnpMatch } from "@/domain/snp";
import type { Player, TeamId } from "@/domain/types";
import { provisionalMatch, unpublishedFixtures } from "./provisional-results";

export async function loadSeasonRanking(teamId: TeamId, players?: Player[], now = Date.now()) {
  const [roster, fixtures] = await Promise.all([players ?? clubRepository.getPlayers(teamId), clubRepository.getFixtures(teamId)]);
  const completed = fixtures.filter(f => !f.provisional && f.score && f.score[0] + f.score[1] > 0);
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
  // Played fixtures that SNP has not closed yet count with the results and the lineup of the app.
  const provisional = (await Promise.all(unpublishedFixtures(fixtures, now).map(f => provisionalMatch(teamId, f, roster).catch(() => null)))).filter(p => p !== null);
  for (const p of provisional) matches.push({ match: p.match, side: p.side });
  const { rows, unassigned } = seasonRanking(roster, matches);
  return { rows, unassigned, unavailable, saved, consulted: matches.length - provisional.length, completed: completed.length, provisionalRounds: provisional.map(p => p.fixture.round) };
}

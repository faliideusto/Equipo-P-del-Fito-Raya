import { sourceTeams } from "@/data/repository";
import { fixtureStart, RESULT_DELAY_MS } from "@/domain/pending-results";
import { actaHasLineup, emptyActa, provisionalActa, type ProvisionalPlayer } from "@/domain/provisional-acta";
import type { SnpMatch } from "@/domain/snp";
import { actaForecast, rankingForecast } from "@/domain/snp-points";
import type { Fixture, Player, TeamId } from "@/domain/types";
import { listResults } from "./match-results";
import { getSnpMatch } from "./snp-service";
import { getRankingHistory } from "./snp-ranking";
import { walletStore } from "./wallet-store";
export type ProvisionalMatch = { fixture: Fixture; match: SnpMatch; side: 0 | 1 };
// Fixtures already played (the usual hour after the start) that SNP has not closed: no SNP score in the calendar.
export const unpublishedFixtures = (fixtures: Fixture[], now = Date.now()) =>
  fixtures.filter(f => { const start = fixtureStart(f.date); return start !== null && start + RESULT_DELAY_MS <= now && (f.provisional || !(f.score && f.score[0] + f.score[1] > 0)); });
// The acta of a played fixture completed with the app (results and published lineup) until SNP shows
// the lineup of every game. null when SNP already has it or there is nothing to add.
export async function provisionalMatch(teamId: TeamId, fixture: Fixture, players: Player[]): Promise<ProvisionalMatch | null> {
  const [acta, rows, published] = await Promise.all([
    getSnpMatch(fixture.id).then(r => r.data).catch(() => emptyActa(fixture.id)),
    listResults([fixture.id]).catch(() => []),
    walletStore().publishedLineup(teamId, fixture.id).catch(() => null),
  ]);
  const index = acta.teamIds?.indexOf(sourceTeams[teamId]) ?? -1;
  const side = (index >= 0 ? index : fixture.home ? 0 : 1) as 0 | 1;
  if (actaHasLineup(acta, side)) return null;
  const person = (sourceId: string): ProvisionalPlayer => ({ id: sourceId, name: players.find(p => p.sourceId === sourceId)?.name ?? sourceId });
  const own = rows.filter(r => r.team_id === teamId);
  const lineup: Record<number, ProvisionalPlayer[]> = {};
  // The published lineup is frozen in pair order: array position + 1 is the pair number.
  published?.pairs.forEach((pair, i) => {
    const ids = pair.players.flatMap(id => { const sourceId = players.find(p => p.id === id)?.sourceId; return sourceId ? [sourceId] : []; });
    if (ids.length) lineup[i + 1] = ids.map(person);
  });
  // Without a published lineup, at least the player who sent the result.
  for (const r of own) if (!lineup[r.pair_index]) lineup[r.pair_index] = [person(r.player_id)];
  if (!own.length && !Object.keys(lineup).length) return null;
  return { fixture, side, match: provisionalActa({ acta, ownSide: side, appResults: Object.fromEntries(own.map(r => [r.pair_index, r.sets])), lineup }) };
}
// SNP ranking forecast for the players of the last played fixture that SNP has not closed, from the
// same formula as the acta view (docs/puntos-snp.md). Keyed by SNP player id; the round's points
// are only forecast once a game of that player has a winner.
export async function provisionalRanking(teamId: TeamId, fixtures: Fixture[], players: Player[], now = Date.now()): Promise<{ round: number; points: Record<string, number> } | null> {
  const fixture = unpublishedFixtures(fixtures, now).sort((a, b) => b.round - a.round)[0];
  const provisional = fixture ? await provisionalMatch(teamId, fixture, players).catch(() => null) : null;
  if (!provisional) return null;
  const { match, side } = provisional;
  const round = Number(match.title.match(/\[\s*Jornada\s*(\d+)\s*\]/i)?.[1]);
  if (!Number.isInteger(round) || round < 1) return null;
  const forecast = actaForecast(match.title, match.games.map(g => g.sets.length ? g.sets : null));
  const people = match.games.flatMap(game => { const gained = forecast[game.index]?.[side]; return gained ? ((side === 0 ? game.home : game.away) ?? []).filter(p => /^\d+$/.test(p.id)).map(p => ({ id: p.id, gained: gained.points })) : []; });
  const points: Record<string, number> = {};
  for (let i = 0; i < people.length; i += 5) await Promise.all(people.slice(i, i + 5).map(async ({ id, gained }) => {
    try { const value = rankingForecast((await getRankingHistory(id, match.title)).data, match.title, round, gained); if (value) points[id] = value.after; } catch { /* Sin historial SNP, sin previsión. */ }
  }));
  return Object.keys(points).length ? { round, points } : null;
}

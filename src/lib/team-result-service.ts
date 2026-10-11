import { clubRepository, sourceTeams } from "@/data/repository";
import { lastPlayedFixture } from "@/domain/pending-results";
import { buildTeamResultMessage, teamResultPairs, teamScore, whatsappShareUrl, type TeamResultPair } from "@/domain/team-result-message";
import type { SnpMatch } from "@/domain/snp";
import type { Fixture, TeamId } from "@/domain/types";
import { getSnpMatch } from "./snp-service";
import { listResults } from "./match-results";
import { shareableTeams } from "./team-captains";
export type TeamResultMessage = { fixtureId: string; teamId: TeamId; round: number; text: string; url: string };
// The five pairs from our side for a fixture, or null while any pair lacks a result.
export async function resultPairs(teamId: TeamId, fixture: Fixture, acta?: SnpMatch | null): Promise<TeamResultPair[] | null> {
  const [rows, match, players] = await Promise.all([listResults([fixture.id]), acta !== undefined ? acta : getSnpMatch(fixture.id).then(r => r.data).catch(() => null), clubRepository.getPlayers(teamId).catch(() => [])]);
  const own = rows.filter(r => r.team_id === teamId);
  const index = match?.teamIds?.indexOf(sourceTeams[teamId]) ?? -1;
  const ownSide = (index >= 0 ? index : fixture.home ? 0 : 1) as 0 | 1;
  const submitterNames: Record<number, string> = {};
  for (const r of own) { const name = players.find(p => p.sourceId === r.player_id)?.name; if (name) submitterNames[r.pair_index] = name; }
  return teamResultPairs({ appResults: Object.fromEntries(own.map(r => [r.pair_index, r.sets])), acta: match, ownSide, submitterNames });
}
// Built on the server only: the client never supplies any data for the message.
export async function teamResultMessage(teamId: TeamId, fixture: Fixture, acta?: SnpMatch | null): Promise<TeamResultMessage | null> {
  const pairs = await resultPairs(teamId, fixture, acta);
  if (!pairs) return null;
  const text = buildTeamResultMessage({ round: fixture.round, teamId, opponent: fixture.opponent, home: fixture.home, date: fixture.date, pairs });
  return { fixtureId: fixture.id, teamId, round: fixture.round, text, url: whatsappShareUrl(text) };
}
// Same rule as the WhatsApp message; SNP's published score is the fallback.
export async function teamResultScore(teamId: TeamId, fixture: Fixture): Promise<[number, number] | null> {
  const pairs = await resultPairs(teamId, fixture);
  if (pairs) return teamScore(pairs);
  return fixture.score ? (fixture.home ? fixture.score : [fixture.score[1], fixture.score[0]]) : null;
}
export async function shareableResults(user: { id: string; role?: string } | null, now = Date.now()): Promise<TeamResultMessage[]> {
  const teams = await shareableTeams(user);
  const items = await Promise.all(teams.map(async teamId => {
    const fixture = lastPlayedFixture(await clubRepository.getFixtures(teamId).catch(() => []), now);
    return fixture ? teamResultMessage(teamId, fixture).catch(() => null) : null;
  }));
  return items.filter((item): item is TeamResultMessage => item !== null);
}

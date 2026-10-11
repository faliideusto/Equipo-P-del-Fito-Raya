import { clubRepository, sourceTeams } from "@/data/repository";
import { getSnpMatch } from "./snp-service";
import { lastPlayedFixture, pendingFor, readActa, type ActaReading, type PendingResult } from "@/domain/pending-results";
import { listAbsences, listResults, type MatchResultRow } from "./match-results";
import type { Fixture, TeamId } from "@/domain/types";
const TEAMS: TeamId[] = ["a", "b"];
export type CoachTeamResults = { teamId: TeamId; fixture: { id: string; round: number; opponent: string; date: string } | null; results: (MatchResultRow & { player_name: string })[] };
export function resolvePair(locked: number | null, requested: unknown): number | null {
  if (locked) return locked;
  return Number.isInteger(requested) && (requested as number) >= 1 && (requested as number) <= 5 ? requested as number : null;
}
async function lastFixture(team: TeamId, now: number): Promise<Fixture | null> {
  try { return lastPlayedFixture(await clubRepository.getFixtures(team), now); } catch { return null; }
}
// SNP failures never create a reminder: the next check will retry.
export async function pendingResults(userId: string, playerId: string, now = Date.now()): Promise<PendingResult[]> {
  const candidates: { team: TeamId; fixture: Fixture; acta: ActaReading }[] = [];
  for (const team of TEAMS) {
    try {
      if (!(await clubRepository.getPlayers(team)).some(p => p.sourceId === playerId)) continue;
      const fixture = await lastFixture(team, now); if (!fixture) continue;
      let acta: ActaReading = { kind: "unknown" };
      try { const result = await getSnpMatch(fixture.id); acta = readActa(result.data, result.stale, sourceTeams[team], fixture.home, playerId); } catch { /* unknown */ }
      candidates.push({ team, fixture, acta });
    } catch { continue; }
  }
  if (!candidates.length) return [];
  const [absences, results] = await Promise.all([listAbsences(userId), listResults(candidates.map(c => c.fixture.id))]);
  const reports = { dismissedFixtureIds: new Set(absences.map(a => a.fixture_id)), results: results.map(r => ({ fixtureId: r.fixture_id, teamId: r.team_id, pairIndex: r.pair_index, submittedBy: r.submitted_by })) };
  return candidates.flatMap(c => pendingFor({ teamId: c.team, fixture: c.fixture, acta: c.acta, userId, reports }) ?? []);
}
export async function coachResults(now = Date.now()): Promise<CoachTeamResults[]> {
  return Promise.all(TEAMS.map(async teamId => {
    const fixture = await lastFixture(teamId, now);
    if (!fixture) return { teamId, fixture: null, results: [] };
    const [rows, players] = await Promise.all([listResults([fixture.id]), clubRepository.getPlayers(teamId).catch(() => [])]);
    const name = (id: string) => players.find(p => p.sourceId === id)?.name ?? "Jugador";
    return { teamId, fixture: { id: fixture.id, round: fixture.round, opponent: fixture.opponent, date: fixture.date }, results: rows.filter(r => r.team_id === teamId).map(r => ({ ...r, player_name: name(r.player_id) })) };
  }));
}

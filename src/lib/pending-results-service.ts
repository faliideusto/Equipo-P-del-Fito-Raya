import { clubRepository, sourceTeams } from "@/data/repository";
import { getSnpMatch } from "./snp-service";
import { lastPlayedFixture, pendingFor, readActa, type ActaReading, type PendingResult } from "@/domain/pending-results";
import { latestStarted } from "@/domain/fixture-navigation";
import { myResult } from "@/domain/result-edit";
import type { SetScore } from "@/domain/match-result";
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
  const checks = await Promise.all(TEAMS.map(async (team): Promise<{ team: TeamId; fixture: Fixture; acta: ActaReading } | null> => {
    try {
      const [players, fixture] = await Promise.all([clubRepository.getPlayers(team), lastFixture(team, now)]);
      if (!fixture || !players.some(p => p.sourceId === playerId)) return null;
      let acta: ActaReading = { kind: "unknown" };
      try { const result = await getSnpMatch(fixture.id); acta = readActa(result.data, result.stale, sourceTeams[team], fixture.home, playerId); } catch { /* unknown */ }
      return { team, fixture, acta };
    } catch { return null; }
  }));
  const candidates = checks.filter(c => c !== null);
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
export type MyResult = { fixtureId: string; teamId: TeamId; pairIndex: number; sets: SetScore[]; submittedByName: string; editable: boolean };
export async function myFixtureResult(userId: string, playerId: string, teamId: TeamId, fixtureId: string): Promise<MyResult | null> {
  const fixture = (await clubRepository.getFixtures(teamId)).find(f => f.id === fixtureId);
  if (!fixture) return null;
  const [rows, absences, acta] = await Promise.all([listResults([fixtureId]), listAbsences(userId), getSnpMatch(fixtureId).catch(() => null)]);
  const own = rows.filter(r => r.team_id === teamId);
  const confirmedPair = absences.find(a => a.fixture_id === fixtureId && a.reason === "already_reported")?.pair_index ?? null;
  const result = myResult({ results: own.map(r => ({ pairIndex: r.pair_index, sets: r.sets, submittedBy: r.submitted_by })), userId, playerId, confirmedPair, acta: acta?.data ?? null, ownSnpTeamId: sourceTeams[teamId], home: fixture.home });
  if (!result) return null;
  const row = own.find(r => r.pair_index === result.pairIndex)!;
  const players = await clubRepository.getPlayers(teamId).catch(() => []);
  return { fixtureId, teamId, pairIndex: result.pairIndex, sets: result.sets, submittedByName: players.find(p => p.sourceId === row.player_id)?.name ?? "Jugador", editable: result.editable };
}
// The user's own team(s); coaches, visitors and players in both teams get the most recent of A and B.
export async function latestFixtureFor(playerId: string | null, now = Date.now()) {
  const mine = playerId ? (await Promise.all(TEAMS.map(async team => (await clubRepository.getPlayers(team).catch(() => [])).some(p => p.sourceId === playerId) ? team : null))).filter((t): t is TeamId => t !== null) : [];
  const teams = mine.length === 1 ? mine : TEAMS;
  return latestStarted(await Promise.all(teams.map(async teamId => ({ teamId, fixtures: await clubRepository.getFixtures(teamId).catch(() => []) }))), now);
}
// Provisional app results shown inside the acta; only the user's own pair is editable.
export async function fixtureProvisional(userId: string | null, playerId: string | null, teamId: TeamId, fixture: Fixture, teamIds: [string, string] | undefined) {
  const [rows, mine] = await Promise.all([listResults([fixture.id]).catch(() => []), userId && playerId ? myFixtureResult(userId, playerId, teamId, fixture.id).catch(() => null) : null]);
  const ownIndex = teamIds?.indexOf(sourceTeams[teamId]) ?? -1;
  return { fixtureId: fixture.id, teamId, ownSide: (ownIndex >= 0 ? ownIndex : fixture.home ? 0 : 1) as 0 | 1, results: Object.fromEntries(rows.filter(r => r.team_id === teamId).map(r => [r.pair_index, r.sets])), editablePair: mine?.editable ? mine.pairIndex : null };
}

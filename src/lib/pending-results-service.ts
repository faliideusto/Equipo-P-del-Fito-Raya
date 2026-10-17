import { clubRepository, sourceTeams } from "@/data/repository";
import { getSnpMatch } from "./snp-service";
import { fixtureStart, lastPlayedFixture, pendingFor, readActa, RESULT_DELAY_MS, type ActaReading, type PendingResult } from "@/domain/pending-results";
import { latestStarted } from "@/domain/fixture-navigation";
import { managedEditablePairs, myResult } from "@/domain/result-edit";
import type { SetScore } from "@/domain/match-result";
import type { SnpMatch } from "@/domain/snp";
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
export type MyResult = { fixtureId: string; teamId: TeamId; pairIndex: number; sets: SetScore[]; editable: boolean };
// Shared by the acta view and the edit action; reuses the fixture and acta the caller already has.
async function ownResult(userId: string | null, playerId: string | null, teamId: TeamId, fixture: Fixture, acta: SnpMatch | null) {
  const [rows, absences] = await Promise.all([listResults([fixture.id]), userId ? listAbsences(userId) : Promise.resolve([])]);
  const own = rows.filter(r => r.team_id === teamId);
  const confirmedPair = absences.find(a => a.fixture_id === fixture.id && a.reason === "already_reported")?.pair_index ?? null;
  const mine = userId && playerId ? myResult({ results: own.map(r => ({ pairIndex: r.pair_index, sets: r.sets, submittedBy: r.submitted_by })), userId, playerId, confirmedPair, acta, ownSnpTeamId: sourceTeams[teamId], home: fixture.home }) : null;
  return { own, mine };
}
export async function myFixtureResult(userId: string, playerId: string, teamId: TeamId, fixtureId: string): Promise<MyResult | null> {
  const fixture = (await clubRepository.getFixtures(teamId)).find(f => f.id === fixtureId);
  if (!fixture) return null;
  const acta = await getSnpMatch(fixtureId).catch(() => null);
  const { mine } = await ownResult(userId, playerId, teamId, fixture, acta?.data ?? null);
  return mine && { fixtureId, teamId, pairIndex: mine.pairIndex, sets: mine.sets, editable: mine.editable };
}
// The user's own team(s); coaches, visitors and players in both teams get the most recent of A and B.
export async function latestFixtureFor(playerId: string | null, now = Date.now()) {
  const mine = playerId ? (await Promise.all(TEAMS.map(async team => (await clubRepository.getPlayers(team).catch(() => [])).some(p => p.sourceId === playerId) ? team : null))).filter((t): t is TeamId => t !== null) : [];
  const teams = mine.length === 1 ? mine : TEAMS;
  return latestStarted(await Promise.all(teams.map(async teamId => ({ teamId, fixtures: await clubRepository.getFixtures(teamId).catch(() => []) }))), now);
}
// Pairs whose app result the coach or a captain may correct (see managedEditablePairs).
export function managedPairs(fixture: Fixture, acta: SnpMatch | null, now = Date.now()) {
  return managedEditablePairs({ acta, start: fixtureStart(fixture.date), now, delay: RESULT_DELAY_MS });
}
// Provisional app results shown inside the acta: players edit their own pair; the coach
// and the team's captain (manager) can edit every pair that SNP has not published yet.
export async function fixtureProvisional(userId: string | null, playerId: string | null, teamId: TeamId, fixture: Fixture, acta: SnpMatch, manager = false) {
  const { own, mine } = await ownResult(userId, playerId, teamId, fixture, acta).catch(() => ({ own: [], mine: null }));
  const ownIndex = acta.teamIds?.indexOf(sourceTeams[teamId]) ?? -1;
  // The shared coach login has no auth.users identity to attribute a new result to.
  // It can still correct existing results, preserving their original author.
  const editablePairs = manager ? managedPairs(fixture, acta).filter(pair => Boolean(userId) || own.some(r => r.pair_index === pair)) : mine?.editable ? [mine.pairIndex] : [];
  return { fixtureId: fixture.id, teamId, ownSide: (ownIndex >= 0 ? ownIndex : fixture.home ? 0 : 1) as 0 | 1, results: Object.fromEntries(own.map(r => [r.pair_index, r.sets])), editablePairs };
}

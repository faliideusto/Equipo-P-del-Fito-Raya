import type { TeamId } from "@/domain/types";
import type { SnpCompetition } from "@/domain/snp";
import { getSnpCompetition } from "./snp-service";

// Divisions where the club's teams started the season. After the jornada de retos SNP moves each
// team up or down one division for the second phase; the old division keeps only its first phase.
export const BASE_DIVISIONS: Record<TeamId, string> = { a: "2318", b: "2326" };
export const CLUB_SNP_TEAMS: Record<TeamId, string> = { a: "7778", b: "803902" };
type Standings = SnpCompetition["standings"];

// The division whose standings list the team now: its base division, else the neighbouring ones,
// one step and then two. If SNP cannot be read the base division is kept.
export async function divisionOf(teamId: string, base: string, find: (row: Standings[number]) => boolean = row => row.teamId === teamId): Promise<string> {
  const first = await getSnpCompetition({ division: base }).catch(() => null);
  if (!first) return base;
  if (first.data.standings.some(find)) return base;
  const { divisions } = first.data;
  const index = divisions.findIndex(division => division.id === base);
  if (index < 0) return base;
  for (const step of [1, -1, 2, -2]) {
    const candidate = divisions[index + step];
    if (!candidate) continue;
    const result = await getSnpCompetition({ division: candidate.id }).catch(() => null);
    if (result && !result.stale && result.data.standings.some(find)) return candidate.id;
  }
  return base;
}
export const clubDivision = (team: TeamId) => divisionOf(CLUB_SNP_TEAMS[team], BASE_DIVISIONS[team]);
// The first phase and the reto are in the base division and the second phase in the current one.
export async function clubCalendar(team: TeamId) {
  const current = await clubDivision(team);
  const divisions = [...new Set([BASE_DIVISIONS[team], current])];
  const results = await Promise.all(divisions.map(division => getSnpCompetition({ division }).catch(() => null)));
  const calendar = results.flatMap(result => result?.data.calendar ?? []);
  return calendar.filter((fixture, index) => calendar.findIndex(other => other.id === fixture.id) === index);
}


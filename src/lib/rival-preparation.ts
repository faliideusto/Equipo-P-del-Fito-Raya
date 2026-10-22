import type { SnpFixture } from "@/domain/snp";
import type { TeamId } from "@/domain/types";
import { sourceTeams } from "@/data/repository";
import { currentAccount } from "./account-auth";
import { shareableTeams } from "./team-captains";
import { getSnpCompetition } from "./snp-service";

export type RivalPreparation = { teamId: TeamId; fixtureId: string; round: number; date: string | null };
export type RivalFixture = RivalPreparation & { rivalId: string; rivalName: string };
export const teamDivisions: Record<TeamId, string> = { a: "2318", b: "2326" };
type Dependencies = {
  account: typeof currentAccount;
  teams: typeof shareableTeams;
  calendar: (team: TeamId) => Promise<SnpFixture[]>;
};
const defaults: Dependencies = {
  account: currentAccount,
  teams: shareableTeams,
  calendar: async team => (await getSnpCompetition({ division: teamDivisions[team] })).data.calendar,
};

// The first fixture without a score in the club team's own calendar, home or away.
export function nextRivalFixture(teamId: TeamId, calendar: SnpFixture[]): RivalFixture | null {
  const ownId = sourceTeams[teamId];
  const next = calendar
    .filter(f => !f.score && (f.homeId === ownId || f.awayId === ownId))
    .sort((a, b) => a.round - b.round)[0];
  if (!next) return null;
  const home = next.homeId === ownId;
  return { teamId, fixtureId: next.id, round: next.round, date: next.date, rivalId: home ? next.awayId : next.homeId, rivalName: (home ? next.awayName : next.homeName).replaceAll("_", " ") };
}

// The hidden site is for the coach and any club captain, who prepare both teams' rivals.
export async function canPrepareRivals(deps: Pick<Dependencies, "account" | "teams"> = defaults): Promise<boolean> {
  try {
    const user = await deps.account();
    if (!user || (user.role !== "coach" && user.role !== "player")) return false;
    return (await deps.teams(user)).length > 0;
  } catch { return false; }
}

export async function nextRival(teamId: TeamId, calendar: Dependencies["calendar"] = defaults.calendar) {
  return nextRivalFixture(teamId, await calendar(teamId));
}

// Resolve permissions and the club's next opponent on the server, never from URL filters
// or the opponent's own next fixture. Any club captain can prepare both teams' rivals.
export async function rivalPreparations(rivalId: string, deps: Dependencies = defaults): Promise<RivalPreparation[]> {
  if (!(await canPrepareRivals(deps))) return [];
  const teams: TeamId[] = ["a", "b"];
  const results = await Promise.all(teams.map(async teamId => {
    try {
      const next = await nextRival(teamId, deps.calendar);
      if (!next || next.rivalId !== rivalId) return null;
      return { teamId, fixtureId: next.fixtureId, round: next.round, date: next.date };
    } catch { return null; }
  }));
  return results.filter((result): result is RivalPreparation => result !== null);
}

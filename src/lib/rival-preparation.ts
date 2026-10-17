import type { SnpFixture } from "@/domain/snp";
import type { TeamId } from "@/domain/types";
import { sourceTeams } from "@/data/repository";
import { currentAccount } from "./account-auth";
import { shareableTeams } from "./team-captains";
import { getSnpCompetition } from "./snp-service";

export type RivalPreparation = { teamId: TeamId; fixtureId: string; round: number; date: string | null };
type Dependencies = {
  account: typeof currentAccount;
  teams: typeof shareableTeams;
  calendar: (team: TeamId) => Promise<SnpFixture[]>;
};
const defaults: Dependencies = {
  account: currentAccount,
  teams: shareableTeams,
  calendar: async team => (await getSnpCompetition({ division: team === "a" ? "2318" : "2326" })).data.calendar,
};

// Resolve permissions and the club's next opponent on the server, never from URL filters
// or the opponent's own next fixture. Any club captain can prepare both teams' rivals.
export async function rivalPreparations(rivalId: string, deps: Dependencies = defaults): Promise<RivalPreparation[]> {
  try {
    const user = await deps.account();
    if (!user || (user.role !== "coach" && user.role !== "player")) return [];
    if (!(await deps.teams(user)).length) return [];
    const teams: TeamId[] = ["a", "b"];
    const results = await Promise.all(teams.map(async teamId => {
      try {
        const ownId = sourceTeams[teamId];
        const next = (await deps.calendar(teamId))
          .filter(f => !f.score && (f.homeId === ownId || f.awayId === ownId))
          .sort((a, b) => a.round - b.round)[0];
        if (!next || (next.homeId === ownId ? next.awayId : next.homeId) !== rivalId) return null;
        return { teamId, fixtureId: next.id, round: next.round, date: next.date };
      } catch { return null; }
    }));
    return results.filter((result): result is RivalPreparation => result !== null);
  } catch { return []; }
}

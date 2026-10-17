import { fixtures, teams } from "./snp-snapshot";
import type { Fixture, Player, Standing, Team, TeamId } from "@/domain/types";
import { getSnpTeam, getSnpCompetition, getSnpPlayer, getSnpMatch } from "@/lib/snp-service";
import { listResults } from "@/lib/match-results";
import { fixtureStart, RESULT_DELAY_MS } from "@/domain/pending-results";
import { actaScore, provisionalActa } from "@/domain/provisional-acta";
import { readPositions } from "@/lib/player-positions";
import { readNicknames } from "@/lib/player-nicknames";
import { clubRoster, additionalPlayers } from "./club-roster";
import { registeredPositions } from "@/lib/account-profile";
import { clubMembers, localPlayerId, memberSports } from "@/lib/club-members";
export const sourceTeams: Record<TeamId, string> = { a: "7778", b: "803902" };
export interface ClubRepository {
  getTeams(): Promise<Team[]>;
  getTeam(id: TeamId): Promise<Team | undefined>;
  getPlayers(id: TeamId): Promise<Player[]>;
  getStandings(id: TeamId): Promise<Standing[]>;
  getFixtures(id: TeamId): Promise<Fixture[]>;
}
// Replace this adapter with database queries without changing sports rules or UI.
export const clubRepository: ClubRepository = {
  getTeams: async () => teams,
  getTeam: async (id) => teams.find((t) => t.id === id),
  getPlayers: async (id) => {
    const [result, reserves] = await Promise.all([getSnpTeam(sourceTeams[id]), id === "a" ? getSnpTeam(sourceTeams.b) : Promise.resolve(null)]);
    const [positions, registered, members, nicknames] = await Promise.all([readPositions(), registeredPositions(), clubMembers(), readNicknames().catch(() => ({}) as Record<string, string | null>)]);
    const additions = await Promise.all(additionalPlayers.filter(player => player.teams.includes(id)).map(async player => {
      try { return (await getSnpPlayer(player.id, undefined, "20")).data; }
      catch { return player; }
    }));
    const extra = await Promise.all(members.filter(member => member.teams.includes(id)).map(async member => {
      if (localPlayerId(member.player_id)) return memberSports(member);
      try { return (await getSnpPlayer(member.player_id, undefined, "20")).data; }
      catch { return memberSports(member); }
    }));
    return clubRoster(id, result.data.players, reserves?.data.players ?? [], positions, [...additions, ...extra], registered)
      .map(player => ({ ...player, nickname: nicknames[player.sourceId ?? player.id] ?? null }));
  },
  getStandings: async (id) => {
    const result = await getSnpCompetition({division:id === "a" ? "2318" : "2326"});
    return result.data.standings.map(row => ({...row, own: row.teamId === sourceTeams[id]}));
  },
  getFixtures: async (id) => {
    const result=await getSnpCompetition({division:id==="a"?"2318":"2326"});
    const calendar:Fixture[]=result.data.calendar.filter(f=>f.homeId===sourceTeams[id]||f.awayId===sourceTeams[id]).map(f=>{
      const previous=fixtures.find(old=>old.teamId===id&&old.id===f.id);
      const home=f.homeId===sourceTeams[id];
      return {id:f.id,teamId:id,round:f.round,opponent:home?f.awayName:f.homeName,date:f.date?.replace(" ","T")||"",venue:previous?.venue||"Sede por confirmar",home,status:f.score?"played" as const:"pending" as const,matches:f.score?previous?.matches||[]:[],score:f.score};
    }).sort((a,b)=>a.round-b.round);
    return Promise.all(calendar.map(f=>provisionalFixture(id,f)));
  },
};
// A fixture played in the last week (the usual hour after the start) that SNP has not closed counts as
// played once a game has a winner, in the SNP acta or in the app, with that provisional score.
const PROVISIONAL_DAYS = 7;
async function provisionalFixture(teamId: TeamId, fixture: Fixture, now = Date.now()): Promise<Fixture> {
  const start = fixtureStart(fixture.date);
  if (fixture.score || start === null || start + RESULT_DELAY_MS > now || now - start > PROVISIONAL_DAYS * 86400000) return fixture;
  try {
    const [acta, rows] = await Promise.all([getSnpMatch(fixture.id).then(r => r.data), listResults([fixture.id])]);
    const index = acta.teamIds?.indexOf(sourceTeams[teamId]) ?? -1;
    const ownSide = (index >= 0 ? index : fixture.home ? 0 : 1) as 0 | 1;
    const appResults = Object.fromEntries(rows.filter(r => r.team_id === teamId).map(r => [r.pair_index, r.sets]));
    const score = actaScore(provisionalActa({ acta, ownSide, appResults, lineup: {} }));
    return score ? { ...fixture, status: "played", score, provisional: true } : fixture;
  } catch { return fixture; }
}

import { fixtures, teams } from "./snp-snapshot";
import type { Fixture, Player, Standing, Team, TeamId } from "@/domain/types";
import { getSnpTeam, getSnpCompetition, getSnpPlayer } from "@/lib/snp-service";
import { readPositions } from "@/lib/player-positions";
import { clubRoster, additionalPlayers } from "./club-roster";
import { registeredPositions } from "@/lib/account-profile";
import { clubMembers, localPlayerId, memberSports } from "@/lib/club-members";
const sourceTeams = { a: "7778", b: "803902" };
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
    const [positions, registered, members] = await Promise.all([readPositions(), registeredPositions(), clubMembers()]);
    const additions = await Promise.all(additionalPlayers.filter(player => player.teams.includes(id)).map(async player => {
      try { return (await getSnpPlayer(player.id, undefined, "20")).data; }
      catch { return player; }
    }));
    const extra = await Promise.all(members.filter(member => member.teams.includes(id)).map(async member => {
      if (localPlayerId(member.player_id)) return memberSports(member);
      try { return (await getSnpPlayer(member.player_id, undefined, "20")).data; }
      catch { return memberSports(member); }
    }));
    return clubRoster(id, result.data.players, reserves?.data.players ?? [], positions, [...additions, ...extra], registered);
  },
  getStandings: async (id) => {
    const result = await getSnpCompetition({division:id === "a" ? "2318" : "2326"});
    return result.data.standings.map(row => ({...row, own: row.teamId === sourceTeams[id]}));
  },
  getFixtures: async (id) => {
    const result=await getSnpCompetition({division:id==="a"?"2318":"2326"});
    return result.data.calendar.filter(f=>f.homeId===sourceTeams[id]||f.awayId===sourceTeams[id]).map(f=>{
      const previous=fixtures.find(old=>old.teamId===id&&old.id===f.id);
      const home=f.homeId===sourceTeams[id];
      return {id:f.id,teamId:id,round:f.round,opponent:home?f.awayName:f.homeName,date:f.date?.replace(" ","T")||"",venue:previous?.venue||"Sede por confirmar",home,status:f.score?"played" as const:"pending" as const,matches:f.score?previous?.matches||[]:[],score:f.score};
    }).sort((a,b)=>a.round-b.round);
  },
};

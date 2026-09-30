import { fixtures, players, teams } from "./snp-snapshot";
import type { Fixture, Player, Standing, Team, TeamId } from "@/domain/types";
import { getSnpTeam, getSnpCompetition } from "@/lib/snp-service";
import { readPositions } from "@/lib/player-positions";
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
    const result = await getSnpTeam(sourceTeams[id]);
    const positions = await readPositions();
    return result.data.players.map(p => {
      const previous = players.find(old => old.teamId === id && (old.sourceId||old.id.replace(/^[ab]-/,""))===p.id);
      const playerId = previous?.id ?? `${id}-${p.id}`;
      return { id: playerId, sourceId: p.id, name: p.name, teamId: id, points: p.points, position: Object.hasOwn(positions, playerId) ? positions[playerId] : previous?.position ?? null, photoUrl: p.photoUrl };
    }).sort((a,b) => b.points-a.points);
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

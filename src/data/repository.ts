import { fixtures, teams } from "./snp-snapshot";
import type { Fixture, Player, Standing, Team, TeamId } from "@/domain/types";
import { getSnpTeam, getSnpCompetition, getSnpPlayer, getSnpMatch } from "@/lib/snp-service";
import { listResults } from "@/lib/match-results";
import { fixtureStart, RESULT_DELAY_MS } from "@/domain/pending-results";
import { actaScore, emptyActa, provisionalActa } from "@/domain/provisional-acta";
import { applyEncounters, encounterResult } from "@/domain/provisional-standings";
import type { SnpFixture } from "@/domain/snp";
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
    const rows = result.data.standings.map(row => ({...row, own: row.teamId === sourceTeams[id]}));
    // Encounters played in the last week that SNP has not closed count once all five games have a winner.
    const encounters = (await Promise.all(result.data.calendar.filter(f => recentUnclosed(f.date, f.score)).map(f => provisionalEncounter(id, f)))).filter(e => e !== null);
    if (!encounters.length) return rows;
    const changed = new Set(encounters.flatMap(e => [e.homeId, e.awayId]));
    return applyEncounters(rows, encounters).map(row => changed.has(row.teamId ?? "") ? { ...row, provisional: true } : row);
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
function recentUnclosed(date: string | null, score: [number, number] | null | undefined, now = Date.now()) {
  const start = fixtureStart(date?.replace(" ", "T") ?? "");
  return !(score && score[0] + score[1] > 0) && start !== null && start + RESULT_DELAY_MS <= now && now - start <= PROVISIONAL_DAYS * 86400000;
}
// The SNP acta of an encounter; for our own, completed with the results saved in the app.
async function completedActa(teamId: TeamId, fixtureId: string, home: boolean) {
  const [acta, rows] = await Promise.all([getSnpMatch(fixtureId).then(r => r.data).catch(() => emptyActa(fixtureId)), listResults([fixtureId])]);
  const index = acta.teamIds?.indexOf(sourceTeams[teamId]) ?? -1;
  const ownSide = (index >= 0 ? index : home ? 0 : 1) as 0 | 1;
  const appResults = Object.fromEntries(rows.filter(r => r.team_id === teamId).map(r => [r.pair_index, r.sets]));
  return provisionalActa({ acta, ownSide, appResults, lineup: {} });
}
async function provisionalFixture(teamId: TeamId, fixture: Fixture): Promise<Fixture> {
  if (!recentUnclosed(fixture.date, fixture.score)) return fixture;
  try {
    const score = actaScore(await completedActa(teamId, fixture.id, fixture.home));
    return score ? { ...fixture, status: "played", score, provisional: true } : fixture;
  } catch { return fixture; }
}
async function provisionalEncounter(teamId: TeamId, fixture: SnpFixture) {
  const own = fixture.homeId === sourceTeams[teamId] || fixture.awayId === sourceTeams[teamId];
  try {
    const match = own ? await completedActa(teamId, fixture.id, fixture.homeId === sourceTeams[teamId]) : (await getSnpMatch(fixture.id)).data;
    return encounterResult(fixture.homeId, fixture.awayId, match);
  } catch { return null; }
}

import { snpClient } from "./snp-client";
import { cachedSnp } from "./snp-cache";
import { normalizeFixtures, normalizeStandings, parseOptions, parseMatch } from "./snp-parser";
import { fetchSnpTeam } from "./snp-team";
import type { SnpCompetition, SnpOption, SnpTeam } from "@/domain/snp";
import { snapshotCompetition, snapshotTeams } from "@/data/snp-explorer-snapshot";
import { normalizePlayerStats, snpNumber,parsePlayerIdentity } from "./snp-parser";
import type { SnpPlayerProfile } from "@/domain/snp";
import { load } from "cheerio";
import { fixtures as savedFixtures,players as savedPlayers,teams as clubTeams } from "@/data/snp-snapshot";
import { fixtureScore } from "@/domain/rules";
import type { SnpMatch } from "@/domain/snp";
import { sharedPlayerIds } from "@/data/club-roster";
type Query = Partial<SnpCompetition["filters"]>;
function options(value: unknown): SnpOption[] {
  if (!value || typeof value !== "object") throw new Error("SNP ha cambiado el formato de los filtros.");
  const rows=Array.isArray(value)?value:Object.values(value);
  return rows.map(row => ({id:String(row.id),name:String(row.nombre)})).filter(row => /^\d+$/.test(row.id));
}
function pick(value: string | undefined, choices: SnpOption[], preferred?: string) {
  return choices.find(o => o.id === value)?.id || choices.find(o => o.id === preferred)?.id || choices[0]?.id || "00";
}
export function validId(value: string) { if (!/^\d{1,10}$/.test(value)) throw new Error("Identificador SNP no válido."); return value; }
export async function getSnpCompetition(query: Query = {}, force = false) {
  const keys = ["zone","phase","category","group","club","division","round"] as const;
  keys.forEach(key => {if (query[key]) validId(query[key]!);});
  const key = "competition-" + keys.map(k => query[k] || "default").join("-");
  const fallback = snapshotCompetition(query);
  return cachedSnp<SnpCompetition>(key, async () => {
    const bootstrap = await cachedSnp("options-bootstrap", async () => {
      const html = await snpClient.html("/competicion/view/1");
      const zones = parseOptions(html,"#select_zonas"); if (!zones.length) throw new Error("SNP no devolvió las zonas.");
      return zones;
    },undefined,force);
    if(bootstrap.stale)throw new Error(bootstrap.error||"No se pudieron actualizar los filtros de SNP.");
    const zones = bootstrap.data;
    const zone = pick(query.zone,zones,"128");
    const phaseData = await snpClient.ajax("ajaxGetFasesByZona",{zona:zone,competicion:"1"});
    const phases = options(phaseData.fases); const phase = pick(query.phase,phases,String(phaseData.fase_actual || "269"));
    const categoryData = await snpClient.ajax("ajaxGetCategoriaPadreCompeticion",{fase:phase});
    const categories = options(categoryData.categorias); const category = pick(query.category,categories,"15");
    const groupData = await snpClient.ajax("ajaxGetByCategoriaPadre",{fase:phase,idcategoria:category});
    const groups = options(groupData.grupos); const group = pick(query.group,groups,"20");
    const divisionData = await snpClient.ajax("ajaxGetClubByFaseGrupo",{fase:phase,idgrupo:group});
    const clubs=divisionData.divisiones?[]:options(divisionData.clubs||[]);const club=clubs.length?pick(query.club,clubs):"00";
    const divisions = options(clubs.length?(await snpClient.ajax("ajaxGetDivisiones",{fase:phase,club,grupo:group})).divisiones:divisionData.divisiones||[]); const division = pick(query.division,divisions,"2318");
    if (division === "00") return {filters:{zone,phase,category,group,club,division,round:"00"},zones,phases,categories,groups,clubs,divisions,rounds:[],standings:[],fixtures:[],calendar:[]};
    const standingsData = await snpClient.ajax("ajaxGetClasificacion",{iddivision:division});
    const standings = normalizeStandings(standingsData.clasificados); if (!standings.length) throw new Error("SNP no devolvió equipos en esta división.");
    const roundData = await snpClient.ajax("ajaxAccionesResultadosJornada",{iddivision:division,idfase:phase,idclub:club,idcategoria:group});
    const calendar = normalizeFixtures(roundData.partidos);
    const count = Math.min(100,Math.max(0,snpNumber(roundData.numrondas)));
    const orders = [...new Set([...Array.from({length:count},(_,i)=>i+1),...calendar.map(f=>f.round)])].filter(n=>n>0).sort((a,b)=>a-b);
    const rounds = orders.map(order=>({id:String(order),name:order===1000?"Jornada de retos":`Jornada ${order}`}));
    const round = pick(query.round,rounds,"1");
    const resultData = rounds.length ? await snpClient.ajax("ajaxGetResultadosJornada",{iddivision:division,idfase:phase,idclub:club,idcategoria:group,ronda:round}) : {jornada:[]};
    const fixtures = normalizeFixtures(resultData.jornada);
    return {filters:{zone,phase,category,group,club,division,round},zones,phases,categories,groups,clubs,divisions,rounds,standings,fixtures,calendar};
  },fallback,force);
}
export async function getSnpTeam(id: string, force = false) {
  validId(id);
  return cachedSnp<SnpTeam>("team-" + id,async()=>fetchSnpTeam(id),snapshotTeams[id],force);
}
export async function getSnpMatch(id: string, force = false) {
  validId(id);
  const fixture=savedFixtures.find(f=>f.id===id);
  let fallback:SnpMatch|undefined;
  if(fixture?.matches.length){
    const own=clubTeams.find(t=>t.id===fixture.teamId)!;const score=fixtureScore(fixture.matches);
    fallback={id,title:`Jornada ${fixture.round}`,dateLabel:fixture.date,teams:fixture.home?[own.name,fixture.opponent]:[fixture.opponent,own.name],score:[score.home,score.away],games:fixture.matches.map(m=>{const names=m.playerIds.map(pid=>savedPlayers.find(p=>p.id===pid)?.name||"Jugador por confirmar");return {index:m.pairIndex,homePlayers:fixture.home?names:m.opponents,awayPlayers:fixture.home?m.opponents:names,sets:m.sets||[]};})};
  }
  return cachedSnp("match-"+id,async()=>parseMatch(await snpClient.html(`/enfrentamiento/edit/${id}/verG`),id),fallback,force);
}
export async function getSnpPlayer(id:string, teamId?:string, requestedGroup?:string, force=false) {
  validId(id); if(teamId)validId(teamId); if(requestedGroup)validId(requestedGroup);
  // Mi perfil has only the linked player ID. Use the same roster context as
  // the team view, because SNP's zonal rank is supplied by the roster endpoint.
  teamId ??= sharedPlayerIds.some(playerId => playerId === id) ? "803902" : Object.entries(snapshotTeams).find(([, team]) => team.players.some(player => player.id === id))?.[0];
  const team = teamId ? await getSnpTeam(teamId) : undefined;
  const known = team?.data.players.find(p=>p.id===id) || Object.values(snapshotTeams).flatMap(t=>t.players).find(p=>p.id===id);
  const fallback:SnpPlayerProfile|undefined = known ? {...known,groups:[],group:"",stats:[],previousStats:[],statsError:"Conecta SNP para consultar el historial deportivo."} : undefined;
  return cachedSnp<SnpPlayerProfile>(`player-${id}-${teamId||"none"}-${requestedGroup||"default"}`,async()=>{
    const html=await snpClient.html(`/ranking/menu_puntuacion/${id}`); const $=load(html);
    const identity=parsePlayerIdentity(html);
    const categories=await snpClient.ajax("ajaxGetCategoriaGrupoByJugador",{idjugador:id},"ranking");
    const groups=options(categories.grupos_select || []); const group=pick(requestedGroup,groups,"20");
    const name=known?.name || identity.name || $("input[name='texto_jugador']").attr("value") || `Jugador SNP ${id}`;
    const base={id,name,photoUrl:known?.photoUrl||identity.photoUrl,nationalRank:known?.nationalRank||null,zoneRank:known?.zoneRank||null,points:known?.points||0,groups,group,stats:[],previousStats:[]};
    if(group === "00") return base;
    const ranking=await snpClient.ajax("ajaxGetByJugadorAndGrupo",{idjugador:id,idgrupo:group},"ranking");
    const entity=ranking.entity as Record<string,unknown>|undefined;
    if(!entity) return base;
    return {...base,points:snpNumber(entity.puntos),nationalRank:entity.orden?String(entity.orden):base.nationalRank,stats:normalizePlayerStats(ranking.datos),previousStats:normalizePlayerStats(ranking.datos_ant)};
  },fallback,force);
}

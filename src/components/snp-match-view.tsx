import Link from "next/link";
import type { SnpResult,SnpMatch } from "@/domain/snp";
import { PageHeading } from "./sports";
import { TeamLogo } from "./team-logo";
import { ActaGameRows, type ActaProvisional } from "./acta-game-rows";
import { matchDateParts } from "@/lib/snp-parser";
import { CalendarDays, Clock3, MapPin } from "lucide-react";
import { mapsSearchUrl } from "@/domain/team-result-message";
import { actaForecast, rankingForecast, type PlayerRanking } from "@/domain/snp-points";
import { getRankingHistory } from "@/lib/snp-ranking";
import { toActaSets } from "@/domain/result-edit";
export type MatchProvisional = Omit<ActaProvisional, "sets" | "editable"> & { results: Record<number, ActaProvisional["sets"]>; editablePairs: number[] };
export async function SnpMatchView({result,backHref="/competicion",backLabel="Volver a competición",teamQuery="",nav,provisional,venue=null}:{result:SnpResult<SnpMatch>;backHref?:string;backLabel?:string;teamQuery?:string;nav?:React.ReactNode;provisional?:MatchProvisional;venue?:string|null}){
  const match=result.data;
  // SNP sets when published, otherwise the provisional result saved in the app.
  const gameSets=match.games.map(game=>{if(game.sets.length)return game.sets;const saved=provisional?.results[game.index+1];return saved?toActaSets(saved,provisional!.ownSide):null;});
  const forecast=actaForecast(match.title,gameSets);
  const rankings=result.stale?{}:await rankingForecasts(match,forecast);
  function teamLink(side: 0 | 1) {
    const content = <><TeamLogo name={match.teams[side]} large/><span>{match.teams[side]}</span></>;
    const id = match.teamIds?.[side];
    return id ? <Link className="score-team" href={`/competicion/equipos/${id}${teamQuery ? `?${teamQuery}` : ""}`} aria-label={`Ver equipo ${match.teams[side]}`}>{content}</Link> : <span className="score-team">{content}</span>;
  }
  return <>{nav??<Link href={backHref} className="text-link back-link">← {backLabel}</Link>}<PageHeading eyebrow={`ACTA SNP · ${match.id}`} title="El encuentro, al detalle." text={<MatchDate label={match.dateLabel} venue={venue}/>}/>{result.stale&&<div className="snp-warning" role="status">{result.error||"Última consulta guardada."}</div>}<section className="score-banner">{teamLink(0)}<strong>{match.score?match.score.join(" – "):"VS"}</strong>{teamLink(1)}<small>{match.score?"RESULTADO PUBLICADO POR SNP":"PENDIENTE DE RESULTADO"}</small></section><section className="panel results-panel"><div className="results-heading"><div><h2>El acta del encuentro</h2><p>Parejas locales y visitantes · Sets y puntos por partido</p></div><span className="badge blue">{result.stale?"Consulta guardada":"SNP"}</span></div><div className="table-scroll"><table className="results-table"><caption className="sr-only">Acta del encuentro. Cada pareja local y visitante se muestra en una fila con los sets publicados.</caption><thead><tr><th>PARTIDO</th><th>EQUIPO Y PAREJA</th><th>SET 1</th><th>SET 2</th><th>SET 3</th><th>PUNTOS</th></tr></thead>{match.games.map(game=><ActaGameRows key={game.id||game.index} game={game} teams={match.teams} teamIds={match.teamIds} provisional={provisional&&{fixtureId:provisional.fixtureId,teamId:provisional.teamId,ownSide:provisional.ownSide,sets:provisional.results[game.index+1]??null,editable:provisional.editablePairs.includes(game.index+1)}} rankings={rankings}/>)}</table></div>{!match.games.length&&<p className="data-note">SNP todavía no publica la alineación ni los sets de este encuentro.</p>}<p className="results-key"><span/> Set ganado · Los puntos corresponden al ganador del partido completo.</p>{Object.keys(rankings).length>0&&<p className="data-note">Junto a cada jugador: lo que sube o baja su ranking SNP con este partido y cómo queda. Es una previsión con la fórmula de SNP hasta que SNP publique la jornada; el bonus del equipo se suma cuando están los 5 resultados.</p>}</section><p className="data-note">Consulta: {new Date(result.updatedAt).toLocaleString("es-ES",{timeZone:"Europe/Madrid"})} · {result.stale?"Últimos datos disponibles":"Fuente original SNP"}</p></>;
}
// New SNP ranking of each player of the acta, from their SNP history and the forecast points of their game.
async function rankingForecasts(match:SnpMatch,forecast:ReturnType<typeof actaForecast>):Promise<Record<string,PlayerRanking>>{
  const round=Number(match.title.match(/\[\s*Jornada\s*(\d+)\s*\]/i)?.[1]);
  if(!Number.isInteger(round)||round<1)return {};
  const people=match.games.flatMap(game=>([0,1] as const).flatMap(side=>{const gained=forecast[game.index]?.[side];return gained?((side===0?game.home:game.away)??[]).filter(p=>/^\d+$/.test(p.id)).map(person=>({person,gained})):[];}));
  const out:Record<string,PlayerRanking>={};
  for(let i=0;i<people.length;i+=5)await Promise.all(people.slice(i,i+5).map(async({person,gained})=>{
    try{const history=(await getRankingHistory(person.id,match.title)).data;const value=rankingForecast(history,match.title,round,gained.points,person.points??null);if(value)out[person.id]={...value,withBonus:gained.withBonus};}catch{/* Sin historial SNP, sin previsión. */}
  }));
  return out;
}
// Date and time with icons, as in the schedule cards; never the score (it has its own banner).
// The venue, when given, opens Google Maps.
function MatchDate({label,venue}:{label:string;venue:string|null}){
  const {date,time}=matchDateParts(label);
  return <span className="match-date"><span><CalendarDays size={15} aria-hidden/>{date||"Fecha por confirmar"}</span>{time&&<span><Clock3 size={15} aria-hidden/>{time}</span>}{venue&&<a className="match-venue" href={mapsSearchUrl(venue)} target="_blank" rel="noopener noreferrer" aria-label={`${venue}, abrir en Google Maps`}><MapPin size={15} aria-hidden/>{venue}</a>}</span>;
}

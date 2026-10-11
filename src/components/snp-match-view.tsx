import Link from "next/link";
import type { SnpResult,SnpMatch } from "@/domain/snp";
import { PageHeading } from "./sports";
import { TeamLogo } from "./team-logo";
import { ActaGameRows, type ActaProvisional } from "./acta-game-rows";
import { matchDateParts } from "@/lib/snp-parser";
import { CalendarDays, Clock3 } from "lucide-react";
export type MatchProvisional = Omit<ActaProvisional, "sets" | "editable"> & { results: Record<number, ActaProvisional["sets"]>; editablePairs: number[] };
export function SnpMatchView({result,backHref="/competicion",backLabel="Volver a competición",teamQuery="",nav,provisional}:{result:SnpResult<SnpMatch>;backHref?:string;backLabel?:string;teamQuery?:string;nav?:React.ReactNode;provisional?:MatchProvisional}){
  const match=result.data;
  function teamLink(side: 0 | 1) {
    const content = <><TeamLogo name={match.teams[side]} large/><span>{match.teams[side]}</span></>;
    const id = match.teamIds?.[side];
    return id ? <Link className="score-team" href={`/competicion/equipos/${id}${teamQuery ? `?${teamQuery}` : ""}`} aria-label={`Ver equipo ${match.teams[side]}`}>{content}</Link> : <span className="score-team">{content}</span>;
  }
  return <>{nav??<Link href={backHref} className="text-link back-link">← {backLabel}</Link>}<PageHeading eyebrow={`ACTA SNP · ${match.id}`} title="El encuentro, al detalle." text={<MatchDate label={match.dateLabel}/>}/>{result.stale&&<div className="snp-warning" role="status">{result.error||"Última consulta guardada."}</div>}<section className="score-banner">{teamLink(0)}<strong>{match.score?match.score.join(" – "):"VS"}</strong>{teamLink(1)}<small>{match.score?"RESULTADO PUBLICADO POR SNP":"PENDIENTE DE RESULTADO"}</small></section><section className="panel results-panel"><div className="results-heading"><div><h2>El acta del encuentro</h2><p>Parejas locales y visitantes · Sets y puntos por partido</p></div><span className="badge blue">{result.stale?"Consulta guardada":"SNP"}</span></div><div className="table-scroll"><table className="results-table"><caption className="sr-only">Acta del encuentro. Cada pareja local y visitante se muestra en una fila con los sets publicados.</caption><thead><tr><th>PARTIDO</th><th>EQUIPO Y PAREJA</th><th>SET 1</th><th>SET 2</th><th>SET 3</th><th>PUNTOS</th></tr></thead>{match.games.map(game=><ActaGameRows key={game.id||game.index} game={game} teams={match.teams} teamIds={match.teamIds} provisional={provisional&&{fixtureId:provisional.fixtureId,teamId:provisional.teamId,ownSide:provisional.ownSide,sets:provisional.results[game.index+1]??null,editable:provisional.editablePairs.includes(game.index+1)}}/>)}</table></div>{!match.games.length&&<p className="data-note">SNP todavía no publica la alineación ni los sets de este encuentro.</p>}<p className="results-key"><span/> Set ganado · Los puntos corresponden al ganador del partido completo.</p></section><p className="data-note">Consulta: {new Date(result.updatedAt).toLocaleString("es-ES",{timeZone:"Europe/Madrid"})} · {result.stale?"Últimos datos disponibles":"Fuente original SNP"}</p></>;
}
// Date and time with icons, as in the schedule cards; never the score (it has its own banner).
function MatchDate({label}:{label:string}){
  const {date,time}=matchDateParts(label);
  return <span className="match-date"><span><CalendarDays size={15} aria-hidden/>{date||"Fecha por confirmar"}</span>{time&&<span><Clock3 size={15} aria-hidden/>{time}</span>}</span>;
}

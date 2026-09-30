import Link from "next/link";
import type { SnpResult,SnpMatch } from "@/domain/snp";
import { PageHeading } from "./sports";
import { TeamLogo } from "./team-logo";
import { matchValue } from "@/domain/rules";
export function SnpMatchView({result,backHref="/competicion",backLabel="Volver a competición"}:{result:SnpResult<SnpMatch>;backHref?:string;backLabel?:string}){
  const match=result.data;
  function teamLink(side: 0 | 1) {
    const content = <><TeamLogo name={match.teams[side]} large/><span>{match.teams[side]}</span></>;
    const id = match.teamIds?.[side];
    return id ? <Link className="score-team" href={`/competicion/equipos/${id}`} aria-label={`Ver equipo ${match.teams[side]}`}>{content}</Link> : <span className="score-team">{content}</span>;
  }
  return <><Link href={backHref} className="text-link back-link">← {backLabel}</Link><PageHeading eyebrow={`ACTA SNP · ${match.id}`} title="El encuentro, al detalle." text={match.dateLabel}/>{result.stale&&<div className="snp-warning" role="status">{result.error||"Última consulta guardada."}</div>}<section className="score-banner">{teamLink(0)}<strong>{match.score?match.score.join(" – "):"VS"}</strong>{teamLink(1)}<small>{match.score?"RESULTADO PUBLICADO POR SNP":"PENDIENTE DE RESULTADO"}</small></section><section className="panel results-panel"><div className="results-heading"><div><h2>El acta del encuentro</h2><p>Parejas locales y visitantes · Sets y puntos por partido</p></div><span className="badge blue">{result.stale?"Consulta guardada":"SNP"}</span></div><div className="table-scroll"><table className="results-table"><caption className="sr-only">Acta del encuentro. Cada pareja local y visitante se muestra en una fila con los sets publicados.</caption><thead><tr><th>PARTIDO</th><th>EQUIPO Y PAREJA</th><th>SET 1</th><th>SET 2</th><th>SET 3</th><th>PUNTOS</th></tr></thead>{match.games.map(game=>{
    const victories=game.sets.reduce((n,s)=>n+(s[0]>s[1]?1:0),0);const defeats=game.sets.reduce((n,s)=>n+(s[1]>s[0]?1:0),0);
    const winner=victories>=2?0:defeats>=2?1:null;const value=game.index<5?matchValue(game.index):null;
    return <tbody className="result-group" key={game.id||game.index}>{[0,1].map(side=>{
      const names=side===0?game.homePlayers:game.awayPlayers;const people=side===0?game.home:game.away;const own=match.teams[side].includes("FITO RAYA");
      return <tr key={side} className={own?"club-result":"rival-result"}>{side===0&&<th className="result-number" scope="rowgroup" rowSpan={2}><span>{String(game.index+1).padStart(2,"0")}</span><small>{value??"—"} pts en juego</small></th>}<th className="result-team" scope="row"><small>{match.teams[side]} · {side===0?"Local":"Visitante"}</small>{names.length?names.map((name,i)=>{const person=people?.[i];return <span key={person?.id||i}>{person?.id?<Link href={`/competicion/jugadores/${person.id}${match.teamIds?.[side]?`?equipo=${match.teamIds[side]}`:""}`}>{name}</Link>:name}</span>}):<span>Sin alineación publicada</span>}</th>{[0,1,2].map(i=><td className="result-set" key={i}><span className={game.sets[i]&&game.sets[i][side]>game.sets[i][1-side]?"set-won":""}>{game.sets[i]?.[side]??"—"}</span></td>)}<td className="result-points"><span className={winner===side?"points-earned":""}>{winner===null||value===null?"—":winner===side?value:0}</span></td></tr>;
    })}</tbody>;
  })}</table></div>{!match.games.length&&<p className="data-note">SNP todavía no publica la alineación ni los sets de este encuentro.</p>}<p className="results-key"><span/> Set ganado · Los puntos corresponden al ganador del partido completo.</p></section><p className="data-note">Consulta: {new Date(result.updatedAt).toLocaleString("es-ES",{timeZone:"Europe/Madrid"})} · {result.stale?"Últimos datos disponibles":"Fuente original SNP"}</p></>;
}

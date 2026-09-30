import Link from "next/link";
import { notFound } from "next/navigation";
import { clubRepository } from "@/data/repository";
import { getSnpMatch } from "@/lib/snp-service";
import { seasonRanking } from "@/domain/season-ranking";
import { PageHeading } from "@/components/sports";
import { PlayerAvatar } from "@/components/player-avatar";
import type { SnpMatch } from "@/domain/snp";

export default async function SeasonPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  if (teamId !== "a" && teamId !== "b") notFound();
  const team = (await clubRepository.getTeam(teamId))!;
  const [players, fixtures] = await Promise.all([clubRepository.getPlayers(teamId), clubRepository.getFixtures(teamId)]);
  const completed = fixtures.filter(f => f.score && f.score[0] + f.score[1] > 0);
  const matches: { match: SnpMatch; side: 0 | 1 }[] = [];
  let unavailable = 0; let saved = 0;
  for (let offset = 0; offset < completed.length; offset += 3) {
    const batch = completed.slice(offset, offset + 3);
    const results = await Promise.allSettled(batch.map(f => getSnpMatch(f.id)));
    results.forEach((result, i) => {
      if (result.status === "rejected" || !result.value.data.games.length) { unavailable++; return; }
      if (result.value.stale) saved++;
      matches.push({ match: result.value.data, side: batch[i].home ? 0 : 1 });
    });
  }
  const { rows, unassigned } = seasonRanking(players, matches);
  return <><PageHeading eyebrow={`${team.shortName} · TEMPORADA ACTUAL`} title="Los jugadores que más suman." text="Clasificación por puntos aportados al equipo en los partidos de la temporada."/>
    <p className="data-note">{matches.length} de {completed.length} actas de encuentros con resultado consultadas. {saved > 0 && `${saved} proceden de la última consulta guardada.`}</p>
    {(unavailable > 0 || unassigned > 0) && <p className="snp-warning" role="status">Clasificación parcial: {unavailable} actas no disponibles y {unassigned} participaciones sin identificar en la plantilla actual.</p>}
    <section className="panel"><div className="panel-heading"><h2>Aportación al equipo</h2><span className="badge blue">{team.shortName}</span></div><div className="table-scroll"><table className="standings"><caption className="sr-only">Estadísticas de jugadores de la temporada actual</caption><thead><tr><th>POS.</th><th>JUGADOR</th><th>PTS EQUIPO</th><th>PJ</th><th>GANADOS</th><th>PERDIDOS</th><th>SETS GANADOS</th><th>SETS PERDIDOS</th></tr></thead><tbody>{rows.map((row, i) => <tr key={row.player.id}><td><span className="rank">{i + 1}</span></td><td><Link className="standing-team" href={`/competicion/jugadores/${row.player.sourceId ?? row.player.id}?equipo=${teamId === "a" ? "7778" : "803902"}`}><PlayerAvatar name={row.player.name} photoUrl={row.player.photoUrl ?? null} small/><span>{row.player.name}</span></Link></td><td><strong>{row.points}</strong></td><td>{row.played}</td><td>{row.won}</td><td>{row.lost}</td><td>{row.setsWon}</td><td>{row.setsLost}</td></tr>)}</tbody></table></div></section>
    <p className="data-note">Cada integrante recibe los 3 o 2 puntos que su pareja ganó para el equipo. No son puntos de ranking SNP: la suma individual cuenta cada victoria dos veces. Solo se contabilizan partidos resueltos por los sets publicados. Desempates: partidos ganados, diferencia de sets y nombre. Incluye los encuentros del calendario de la fase actual y los jugadores de la plantilla actual.</p>
    {!completed.length && <p className="data-note">Todavía no hay encuentros con resultado publicado en este calendario.</p>}
  </>;
}

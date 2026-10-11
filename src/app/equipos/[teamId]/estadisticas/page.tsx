import { notFound } from "next/navigation";
import { clubRepository } from "@/data/repository";
import { loadSeasonRanking } from "@/lib/season-ranking-service";
import { PageHeading } from "@/components/sports";
import { SeasonRankingTable } from "@/components/season-ranking-table";
import { SeasonRankingCards } from "@/components/season-ranking-cards";
import { ViewToggle, squadView } from "@/components/view-toggle";

export default async function SeasonPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<{ vista?: string | string[] }> }) {
  const { teamId } = await params;
  if (teamId !== "a" && teamId !== "b") notFound();
  const view = squadView((await searchParams).vista);
  const team = (await clubRepository.getTeam(teamId))!;
  const { rows, unassigned, unavailable, saved, consulted, completed } = await loadSeasonRanking(teamId);
  return <><PageHeading eyebrow={`${team.shortName} · Temporada actual`} title="Ranking de la temporada" text="Jugadores ordenados por los puntos que han aportado al equipo en los partidos jugados."/>
    <p className="data-note">{consulted} de {completed} actas de encuentros con resultado consultadas. {saved > 0 && `${saved} proceden de la última consulta guardada.`}</p>
    {(unavailable > 0 || unassigned > 0) && <p className="snp-warning" role="status">Clasificación parcial: {unavailable} actas no disponibles y {unassigned} participaciones sin identificar en la plantilla actual.</p>}
    <section className="panel"><div className="panel-heading"><h2>Aportación al equipo</h2><ViewToggle view={view} href={`/equipos/${teamId}/estadisticas`}/></div>{view === "cartas" ? <SeasonRankingCards rows={rows} teamId={teamId} teamName={team.shortName}/> : <SeasonRankingTable key={teamId} rows={rows} teamId={teamId}/>}</section>
    <p className="data-note">Cada integrante recibe los 3 o 2 puntos que su pareja ganó para el equipo. No son puntos de ranking SNP: la suma individual cuenta cada victoria dos veces. Solo se contabilizan partidos resueltos por los sets publicados. Desempates: partidos ganados, diferencia de sets y nombre. Incluye los encuentros del calendario de la fase actual y los jugadores de la plantilla actual.</p>
    <p className="data-note">Los winrates coinciden con la ficha del jugador e incluyen todos sus grupos y equipos SNP. Se calculan como victorias / partidos con resultado. El total cubre el historial disponible: temporada actual y anterior; SNP no proporciona temporadas más antiguas en esta ficha. «—» indica que no hay resultados o que el historial no está disponible.</p>
    {!completed && <p className="data-note">Todavía no hay encuentros con resultado publicado en este calendario.</p>}
  </>;
}

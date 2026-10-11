import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { clubRepository } from "@/data/repository";
import type { TeamId } from "@/domain/types";
import { NextMatchBoard, ResultRow, StandingsTable } from "@/components/sports";
import { PlayerAvatar } from "@/components/player-avatar";
import { formatPoints } from "@/lib/format";
import { lineupHref } from "@/domain/wallet-ui";
import { canPublishLineup } from "@/lib/wallet-notify-service";
export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: TeamId }>;
}) {
  const { teamId } = await params;
  const team = (await clubRepository.getTeam(teamId))!;
  const [players, rows, fixtures, canPublish] = await Promise.all([
    clubRepository.getPlayers(teamId),
    clubRepository.getStandings(teamId),
    clubRepository.getFixtures(teamId),
    canPublishLineup(teamId),
  ]);
  const ownIndex = rows.findIndex((r) => r.own);
  const division = teamId === "a" ? "2318" : "2326";
  const sourceTeam = teamId === "a" ? "7778" : "803902";
  const next = fixtures.find((f) => f.status === "pending");
  const opponentIndex = next ? rows.findIndex((r) => r.name.trim().toUpperCase() === next.opponent.trim().toUpperCase()) : -1;
  const played = fixtures.filter((f) => f.status === "played").reverse();
  const top = players.slice(0, 5);
  return (
    <>
      <h1 className="sr-only">{team.name} · Resumen</h1>
      {next ? (
        <NextMatchBoard
          fixture={next}
          team={team}
          lineupHref={lineupHref(teamId, next.id, canPublish)}
          standing={ownIndex >= 0 ? { position: ownIndex + 1, points: rows[ownIndex].points } : undefined}
          opponentStanding={opponentIndex >= 0 ? { position: opponentIndex + 1, points: rows[opponentIndex].points } : undefined}
        />
      ) : (
        <section className="panel empty-state">
          <h2>No hay encuentros pendientes publicados.</h2>
          <p>Consulta el calendario completo en Jornadas.</p>
        </section>
      )}
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Clasificación</h2>
            <Link className="text-link" href={`/equipos/${teamId}/clasificacion`}>Ver completa <ArrowRight size={16} /></Link>
          </div>
          <StandingsTable rows={rows} division={division} compact />
        </section>
        <div className="overview-side">
          <section className="panel">
            <div className="panel-heading">
              <h2>Resultados</h2>
              <Link className="text-link" href={`/equipos/${teamId}/jornadas`}>Calendario <ArrowRight size={16} /></Link>
            </div>
            {played.length ? (
              <div className="result-list">{played.slice(0, 3).map((f) => <ResultRow key={f.id} fixture={f} team={team} />)}</div>
            ) : (
              <p className="panel-empty">Todavía no hay resultados publicados para este equipo.</p>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Mejor ranking SNP</h2>
              <Link className="text-link" href={`/equipos/${teamId}/plantilla`}>{players.length} jugadores <ArrowRight size={16} /></Link>
            </div>
            <ol className="top-players">
              {top.map((player, i) => (
                <li key={player.id}>
                  <Link href={`/competicion/jugadores/${player.sourceId ?? player.id}?equipo=${player.sourceTeamId ?? sourceTeam}`}>
                    <span className="top-rank">{String(i + 1).padStart(2, "0")}</span>
                    <PlayerAvatar name={player.name} photoUrl={player.photoUrl ?? null} />
                    <span className="top-name">{player.name}</span>
                    <span className="top-points">{formatPoints(player.points)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}

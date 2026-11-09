import { withNickname } from "@/domain/team-result-message";
import { clubRepository } from "@/data/repository";
import type { TeamId } from "@/domain/types";
import { positionLabel } from "@/domain/rules";
import { formatPoints } from "@/lib/format";
import Link from "next/link";
import { PlayerAvatar } from "@/components/player-avatar";
import { PageHeading } from "@/components/sports";
import { FifaCard } from "@/components/fifa-card";
import { SquadCourt } from "@/components/squad-court";
import { ViewToggle, squadView } from "@/components/view-toggle";
import { cardPhoto } from "@/data/player-photos";
import { compactPoints, pointsTier, sideShort } from "@/domain/squad";
import { isInForm } from "@/domain/mvp";
import { inFormPlayers } from "@/lib/mvp";
import { provisionalRanking } from "@/lib/provisional-results";
export default async function RosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: TeamId }>;
  searchParams: Promise<{ vista?: string | string[] }>;
}) {
  const { teamId } = await params;
  const view = squadView((await searchParams).vista);
  const team = (await clubRepository.getTeam(teamId))!;
  const [published, fixtures] = await Promise.all([clubRepository.getPlayers(teamId), clubRepository.getFixtures(teamId).catch(() => [])]);
  // Until SNP closes the last played fixture, each player of it also shows the forecast of their SNP
  // ranking with the results saved in the app (the same one as in the acta).
  const forecast = await provisionalRanking(teamId, fixtures, published).catch(() => null);
  const forecastOf = (player: { sourceId?: string }) => player.sourceId ? forecast?.points[player.sourceId] : undefined;
  const players = published;
  // Last month's MVP wears the black IF card.
  const inForm = view === "cartas" ? await inFormPlayers() : [];
  return (
    <>
      <PageHeading
        eyebrow={`${team.shortName} · ${team.division}`}
        title="Plantilla"
        text={`${players.length} jugadores · Orden por puntos SNP publicados${forecast ? ` · Previsión de la J${forecast.round}` : ""}`}
      />
      <section className="panel">
        <div className="panel-heading">
          <h2>Plantilla & ranking SNP</h2>
          <ViewToggle view={view} href={`/equipos/${teamId}/plantilla`} />
        </div>
        {view === "cartas" ? (
          <SquadCourt
            ranked={players}
            keyOf={(player) => player.id}
            label={`Plantilla del ${team.shortName} sobre la pista, por puntos SNP`}
            benchLabel="Ordenados por puntos SNP"
            card={(player, rank) => (
              <FifaCard
                name={player.name}
                nickname={player.nickname}
                photoUrl={cardPhoto(player)}
                rating={compactPoints(player.points)}
                ratingLabel={sideShort(player.position)}
                tier={isInForm(player, inForm) ? "if" : pointsTier(player.points)}
                href={`/competicion/jugadores/${player.sourceId ?? player.id}?equipo=${player.sourceTeamId ?? (teamId === "a" ? "7778" : "803902")}`}
                stats={[
                  { label: "RANK", value: player.points === null ? "—" : rank },
                  { label: "PTS SNP", value: player.points === null ? "—" : Math.round(player.points).toLocaleString("es-ES") },
                  ...(forecastOf(player) ? [{ label: "PREVISIÓN", value: Math.round(forecastOf(player)!.after).toLocaleString("es-ES") }] : []),
                ]}
              />
            )}
          />
        ) : (
        <div className="roster-list">
          {players.map((player, i) => (
            <Link href={`/competicion/jugadores/${player.sourceId ?? player.id}?equipo=${player.sourceTeamId ?? (teamId === "a" ? "7778" : "803902")}`} className="roster-row" key={player.id}>
              <span className={`roster-rank ${i < 3 ? "top" : ""}`}>
                {player.points === null ? "—" : String(i + 1).padStart(2, "0")}
              </span>
              <PlayerAvatar name={player.name} photoUrl={cardPhoto(player)} />
              <div className="roster-name">
                <strong>{withNickname(player.name, player.nickname)}</strong>
                <span>{positionLabel(player.position)}</span>
              </div>
              <div className="points-bar">
                <div
                  style={{
                    width: `${((player.points ?? 0) / (players[0].points || 1)) * 100}%`,
                  }}
                />
              </div>
              <div className="roster-points">
                <strong>{formatPoints(player.points)}</strong>
                <span>PTS SNP</span>
                {forecastOf(player) && <ForecastChange value={forecastOf(player)!} />}
              </div>
            </Link>
          ))}
        </div>
        )}
      </section>
      <p className="data-note">
        Plantilla y puntos consultados directamente en SNP.{forecast && ` «Previsión»: cómo queda el ranking SNP de cada jugador con los resultados de la J${forecast.round} guardados en la app, con la fórmula de SNP; desaparece cuando SNP publique la jornada.`} Los campos de puntuación vacíos en
        SNP se muestran como 0 puntos, según la indicación del club. Las
        posiciones de juego están por confirmar.
      </p>
    </>
  );
}
const whole = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" }).format(n);
// What the player's SNP ranking gains or loses with the last fixture, as in the acta.
function ForecastChange({ value }: { value: { before: number; after: number } }) {
  const change = value.after - value.before;
  return <small className={`roster-forecast ${change < 0 ? "down" : "up"}`} title={`Ranking SNP: ${formatPoints(value.before)} → ${formatPoints(value.after)} (previsión con la fórmula de SNP)`}>{change >= 0 ? "+" : "−"}{whole(Math.abs(change))} → {whole(value.after)} · previsión</small>;
}

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
  const players = await clubRepository.getPlayers(teamId);
  return (
    <>
      <PageHeading
        eyebrow={`${team.shortName} · ${team.division}`}
        title="Plantilla"
        text={`${players.length} jugadores · Orden por puntos SNP publicados`}
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
                photoUrl={cardPhoto(player)}
                rating={compactPoints(player.points)}
                ratingLabel={sideShort(player.position)}
                tier={pointsTier(player.points)}
                href={`/competicion/jugadores/${player.sourceId ?? player.id}?equipo=${player.sourceTeamId ?? (teamId === "a" ? "7778" : "803902")}`}
                stats={[
                  { label: "RANK", value: player.points === null ? "—" : rank },
                  { label: "PTS SNP", value: player.points === null ? "—" : Math.round(player.points).toLocaleString("es-ES") },
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
                <strong>{player.name}</strong>
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
              </div>
            </Link>
          ))}
        </div>
        )}
      </section>
      <p className="data-note">
        Plantilla y puntos consultados directamente en SNP. Los campos de puntuación vacíos en
        SNP se muestran como 0 puntos, según la indicación del club. Las
        posiciones de juego están por confirmar.
      </p>
    </>
  );
}

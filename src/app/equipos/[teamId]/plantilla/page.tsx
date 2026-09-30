import { clubRepository } from "@/data/repository";
import type { TeamId } from "@/domain/types";
import { positionLabel } from "@/domain/rules";
import { formatPoints } from "@/lib/format";
import Link from "next/link";
import { PlayerAvatar } from "@/components/player-avatar";
import { PageHeading } from "@/components/sports";
export default async function RosterPage({
  params,
}: {
  params: Promise<{ teamId: TeamId }>;
}) {
  const { teamId } = await params;
  const team = (await clubRepository.getTeam(teamId))!;
  const players = await clubRepository.getPlayers(teamId);
  return (
    <>
      <PageHeading
        eyebrow={`${team.shortName} / ${team.division}`}
        title="El equipo que suma."
        text={`${players.length} jugadores · Orden por puntos SNP publicados`}
      />
      <section className="panel">
        <div className="panel-heading">
          <h2>Plantilla & ranking SNP</h2>
          <span className="badge blue">{team.shortName}</span>
        </div>
        <div className="roster-list">
          {players.map((player, i) => (
            <Link href={`/competicion/jugadores/${player.sourceId ?? player.id}?equipo=${teamId === "a" ? "7778" : "803902"}`} className="roster-row" key={player.id}>
              <span className={`roster-rank ${i < 3 ? "top" : ""}`}>
                {player.points === null ? "—" : String(i + 1).padStart(2, "0")}
              </span>
              <PlayerAvatar name={player.name} photoUrl={player.photoUrl ?? null} />
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
      </section>
      <p className="data-note">
        Plantilla y puntos consultados directamente en SNP. Los campos de puntuación vacíos en
        SNP se muestran como 0 puntos, según la indicación del club. Las
        posiciones de juego están por confirmar.
      </p>
    </>
  );
}

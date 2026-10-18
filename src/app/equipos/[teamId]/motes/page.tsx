import type { TeamId } from "@/domain/types";
import { clubRepository } from "@/data/repository";
import { PageHeading } from "@/components/sports";
import { NicknameEditor } from "@/components/lineup/nickname-editor";
import { PlayerAvatar } from "@/components/player-avatar";
import { cardPhoto } from "@/data/player-photos";
import { currentAccount } from "@/lib/account-auth";
import { shareableTeams } from "@/lib/team-captains";
// Each team lists its own players; only its coach and captains can edit them.
export default async function NicknamesPage({
  params,
}: {
  params: Promise<{ teamId: TeamId }>;
}) {
  const { teamId } = await params;
  const team = (await clubRepository.getTeam(teamId))!;
  const [players, teams] = await Promise.all([
    clubRepository.getPlayers(teamId),
    currentAccount().catch(() => null).then(user => shareableTeams(user)).catch((): TeamId[] => []),
  ]);
  return (
    <>
      <PageHeading
        eyebrow={`${team.shortName} · Plantilla`}
        title="Motes"
        text={`Los motes de los jugadores del ${team.shortName}. El entrenador y los capitanes del equipo los cambian aquí.`}
      />
      {teams.includes(teamId)
        ? <NicknameEditor key={teamId} players={players} teamId={teamId} />
        : <section className="position-editor">
          <h2>Motes de los jugadores</h2>
          <p>Solo el entrenador o los capitanes del equipo pueden cambiar los motes.</p>
          <div className="position-editor-list">{players.map(player => <div className="position-editor-row" key={player.id}>
            <PlayerAvatar name={player.name} photoUrl={cardPhoto(player)} small /><span>{player.name}</span>
            <strong>{player.nickname || "—"}</strong>
          </div>)}</div>
        </section>}
    </>
  );
}

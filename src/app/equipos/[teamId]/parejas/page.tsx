import type { TeamId } from "@/domain/types";
import { clubRepository } from "@/data/repository";
import { PageHeading } from "@/components/sports";
import { LineupBuilder } from "@/components/lineup/lineup-builder";
export default async function PairsPage({
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
        title="La química también se entrena."
        text="Prueba parejas. Intercambia jugadores. Encuentra tu alineación."
        action={<span className="badge blue team-context">{team.name}</span>}
      />
      <LineupBuilder key={teamId} players={players} teamId={teamId} />
    </>
  );
}

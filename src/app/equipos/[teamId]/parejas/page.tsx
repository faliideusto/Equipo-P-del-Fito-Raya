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
        eyebrow={`${team.shortName} · Laboratorio`}
        title="Crear parejas"
        text="Elige la convocatoria, junta jugadores y mira al momento cuántos puntos SNP suma cada pareja."
      />
      <LineupBuilder key={teamId} players={players} teamId={teamId} />
    </>
  );
}

import type { TeamId } from "@/domain/types";
import { clubRepository } from "@/data/repository";
import { PageHeading } from "@/components/sports";
import { LineupBuilder } from "@/components/lineup/lineup-builder";
import { currentAccount } from "@/lib/account-auth";
import { shareableTeams } from "@/lib/team-captains";
export default async function PairsPage({
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
        eyebrow={`${team.shortName} · Laboratorio`}
        title="Crear parejas"
        text="Elige la convocatoria, junta jugadores y mira al momento cuántos puntos SNP suma cada pareja."
      />
      <LineupBuilder key={teamId} players={players} teamId={teamId} canEditNicknames={teams.includes(teamId)} />
    </>
  );
}

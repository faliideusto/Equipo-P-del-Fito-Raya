import { clubRepository } from "@/data/repository";
import type { TeamId } from "@/domain/types";
import { PageHeading } from "@/components/sports";
import { TeamSchedule } from "@/components/team-schedule";
import { fixtureScore } from "@/domain/rules";
export default async function FixturesPage({
  params,
}: {
  params: Promise<{ teamId: TeamId }>;
}) {
  const { teamId } = await params;
  const team = (await clubRepository.getTeam(teamId))!;
  const fixtures = await clubRepository.getFixtures(teamId);
  const sourceId = teamId === "a" ? "7778" : "803902";
  const calendar = fixtures.map((f) => ({
    id: f.id, round: f.round, date: f.date,
    homeId: f.home ? sourceId : "", awayId: f.home ? "" : sourceId,
    homeName: f.home ? team.name : f.opponent, awayName: f.home ? f.opponent : team.name,
    score: f.score || (f.status === "played" ? [fixtureScore(f.matches).home, fixtureScore(f.matches).away] as [number, number] : null),
    state: f.status,
  }));
  return (
    <>
      <PageHeading
        eyebrow={`Equipo ${teamId.toUpperCase()}`}
        title="Jornadas"
        text="Calendario y resultados de la temporada. Pulsa un encuentro para ver las parejas y los sets."
      />
      <TeamSchedule fixtures={calendar} teamId={sourceId} matchBaseHref={`/equipos/${teamId}/jornadas`} />
      <p className="data-note">
        Calendario directo de SNP. Las jornadas sin encuentro para nuestro equipo no aparecen en esta lista. Sedes por confirmar. Puntos por partido: 3 / 3 / 2 / 2 / 2.
      </p>
    </>
  );
}

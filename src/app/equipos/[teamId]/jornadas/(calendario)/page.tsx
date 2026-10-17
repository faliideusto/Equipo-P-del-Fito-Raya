import { clubRepository } from "@/data/repository";
import type { TeamId } from "@/domain/types";
import { PageHeading } from "@/components/sports";
import { TeamSchedule } from "@/components/team-schedule";
import { TeamCalendar } from "@/components/team-calendar";
import { ScheduleViewToggle, scheduleView } from "@/components/view-toggle";
import { fixtureScore } from "@/domain/rules";
export default async function FixturesPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: TeamId }>;
  searchParams: Promise<{ vista?: string | string[] }>;
}) {
  const { teamId } = await params;
  const view = scheduleView((await searchParams).vista);
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
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  return (
    <>
      <PageHeading
        eyebrow={`Equipo ${teamId.toUpperCase()}`}
        title="Jornadas"
        text="Calendario y resultados de la temporada. Pulsa un encuentro para ver las parejas y los sets."
        action={<ScheduleViewToggle view={view} href={`/equipos/${teamId}/jornadas`} />}
      />
      {view === "calendario"
        ? <TeamCalendar fixtures={calendar} teamId={sourceId} today={today} matchBaseHref={`/equipos/${teamId}/jornadas`} />
        : <TeamSchedule fixtures={calendar} teamId={sourceId} matchBaseHref={`/equipos/${teamId}/jornadas`} />}
      <p className="data-note">
        Calendario directo de SNP. Las jornadas sin encuentro para nuestro equipo no aparecen en esta lista. Sedes por confirmar. Puntos por partido: 3 / 3 / 2 / 2 / 2.
      </p>
    </>
  );
}

import { clubRepository } from "@/data/repository";
import type { TeamId } from "@/domain/types";
import { PageHeading } from "@/components/sports";
import { LeagueTable } from "@/components/league-table";
import { clubDivision } from "@/lib/club-division";
import { leagueExtras } from "@/lib/league-table";
export default async function StandingsPage({
  params,
}: {
  params: Promise<{ teamId: TeamId }>;
}) {
  const { teamId } = await params;
  const team = (await clubRepository.getTeam(teamId))!;
  const [rows, division, extras] = await Promise.all([
    clubRepository.getStandings(teamId),
    clubDivision(teamId),
    leagueExtras(teamId).catch(() => ({ form: {}, next: {} })),
  ]);
  return (
    <>
      <PageHeading
        eyebrow={`${team.shortName} · ${team.division}`}
        title="Clasificación"
        text="Tabla de liga publicada por SNP · Temporada 2026 / 27"
      />
      <LeagueTable rows={rows} division={division} form={extras.form} next={extras.next} />
    </>
  );
}

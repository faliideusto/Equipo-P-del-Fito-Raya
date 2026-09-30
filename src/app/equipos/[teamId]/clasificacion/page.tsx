import { clubRepository } from "@/data/repository";
import type { TeamId } from "@/domain/types";
import { PageHeading, StandingsTable } from "@/components/sports";
export default async function StandingsPage({
  params,
}: {
  params: Promise<{ teamId: TeamId }>;
}) {
  const { teamId } = await params;
  const team = (await clubRepository.getTeam(teamId))!;
  const rows = await clubRepository.getStandings(teamId);
  return (
    <>
      <PageHeading
        eyebrow={`${team.shortName} / ${team.division}`}
        title="Cada punto cuenta."
        text="Clasificación de liga · Temporada 2026 / 27"
      />
      <section className="panel">
        <div className="panel-heading">
          <h2>Clasificación</h2>
          <span className="badge blue">{team.shortName}</span>
        </div>
        <StandingsTable rows={rows} />
      </section>
      <p className="data-note">
        Clasificación publicada por SNP. Se conserva
        el orden y las victorias publicados, incluidos los encuentros con
        marcador 6–6.
      </p>
    </>
  );
}

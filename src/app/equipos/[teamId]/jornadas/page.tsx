import { clubRepository } from "@/data/repository";
import type { TeamId } from "@/domain/types";
import { FixtureCard, PageHeading } from "@/components/sports";
export default async function FixturesPage({
  params,
}: {
  params: Promise<{ teamId: TeamId }>;
}) {
  const { teamId } = await params;
  const team = (await clubRepository.getTeam(teamId))!;
  const fixtures = await clubRepository.getFixtures(teamId);
  const next = fixtures.find((f) => f.status === "pending");
  return (
    <>
      <PageHeading
        eyebrow={`${team.shortName} / ${team.division}`}
        title="La temporada, partido a partido."
        text="Consulta el calendario y los resultados de cada jornada."
      />
      <p className="data-note">
        Calendario directo de SNP. Las jornadas sin encuentro para nuestro equipo no aparecen en esta lista. Sedes por confirmar.
      </p>
      <div className="section-title">
        <h2>Próxima jornada</h2>
      </div>
      {next ? (
        <FixtureCard fixture={next} team={team} prominent />
      ) : (
        <p>No hay próximos encuentros publicados en esta consulta.</p>
      )}
      <div className="section-title">
        <h2>Por disputar</h2>
      </div>
      <div className="team-grid">
        {fixtures
          .filter((f) => f.status === "pending")
          .slice(1)
          .map((f) => (
            <FixtureCard key={f.id} fixture={f} team={team} />
          ))}
      </div>
      <div className="section-title">
        <h2>Resultados</h2>
        <span>Puntos por partido: 3 / 3 / 2 / 2 / 2</span>
      </div>
      <div className="team-grid">
        {fixtures
          .filter((f) => f.status === "played")
          .reverse()
          .map((f) => (
            <FixtureCard key={f.id} fixture={f} team={team} />
          ))}
      </div>
    </>
  );
}

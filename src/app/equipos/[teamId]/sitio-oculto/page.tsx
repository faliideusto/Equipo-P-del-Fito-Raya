import type { TeamId } from "@/domain/types";
import { clubRepository } from "@/data/repository";
import { PageHeading } from "@/components/sports";
import { MiniLineup } from "@/components/lineup/mini-lineup";
import { canPrepareRivals, nextRival, teamDivisions } from "@/lib/rival-preparation";
import { readRivalLineup } from "@/lib/rival-lineups";
import { getSnpTeam } from "@/lib/snp-service";
// Only the coach and the club captains see this section; everything is checked on the server.
export default async function HiddenSitePage({
  params,
}: {
  params: Promise<{ teamId: TeamId }>;
}) {
  const { teamId } = await params;
  const team = (await clubRepository.getTeam(teamId))!;
  const heading = <PageHeading eyebrow={`${team.shortName} · Privado`} title="Sitio oculto" text="Prepara la alineación que esperáis del próximo rival. Solo la ven el entrenador y los capitanes." />;
  if (!(await canPrepareRivals())) return <>{heading}<section className="panel empty-state"><h2>Sección privada.</h2><p>Solo el entrenador y los capitanes pueden entrar en el sitio oculto.</p></section></>;
  const next = await nextRival(teamId).catch(() => null);
  if (!next) return <>{heading}<section className="panel empty-state"><h2>No hay próximo rival.</h2><p>SNP no tiene encuentros pendientes publicados para el {team.shortName}.</p></section></>;
  const [rival, saved] = await Promise.all([
    getSnpTeam(next.rivalId).then(result => result.data).catch(() => null),
    readRivalLineup(teamId, next.fixtureId).then(value => ({ value, error: "" })).catch((error: unknown) => ({ value: null, error: error instanceof Error ? error.message : "No se pudo leer la alineación guardada." })),
  ]);
  return (
    <>
      {heading}
      {saved.error && <p className="snp-warning" role="status">{saved.error}</p>}
      {rival
        ? <MiniLineup key={`${teamId}-${next.fixtureId}`} players={rival.players} preparation={next} division={teamDivisions[teamId]} initial={saved.value} />
        : <section className="panel empty-state"><h2>Plantilla no disponible.</h2><p>SNP no ha devuelto la plantilla de {next.rivalName}. Vuelve a intentarlo en un rato.</p></section>}
    </>
  );
}

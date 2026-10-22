import type { TeamId } from "@/domain/types";
import { clubRepository } from "@/data/repository";
import { cardPhoto } from "@/data/player-photos";
import { withNickname } from "@/domain/team-result-message";
import { emptyLineup } from "@/domain/rules";
import { PageHeading } from "@/components/sports";
import { HiddenSite } from "@/components/hidden-site/hidden-site";
import type { LineupPlayer } from "@/components/hidden-site/types";
import { canPrepareRivals, nextRival, teamDivisions } from "@/lib/rival-preparation";
import { readRivalLineup } from "@/lib/rival-lineups";
import { getSnpTeam } from "@/lib/snp-service";
import { walletStore } from "@/lib/wallet-store";
// Only the coach and the club captains see this section; everything is checked on the server.
export default async function HiddenSitePage({
  params,
}: {
  params: Promise<{ teamId: TeamId }>;
}) {
  const { teamId } = await params;
  const team = (await clubRepository.getTeam(teamId))!;
  const heading = <PageHeading eyebrow={`${team.shortName} · Privado`} title="Sitio oculto" text="Prepara el próximo partido: la alineación que esperáis del rival y cómo se cruza con la nuestra." />;
  if (!(await canPrepareRivals())) return <>{heading}<section className="panel empty-state"><h2>Sección privada.</h2><p>Solo el entrenador y los capitanes pueden entrar en el sitio oculto.</p></section></>;
  const next = await nextRival(teamId).catch(() => null);
  if (!next) return <>{heading}<section className="panel empty-state"><h2>No hay próximo rival.</h2><p>SNP no tiene encuentros pendientes publicados para el {team.shortName}.</p></section></>;
  const [rival, saved, players, published] = await Promise.all([
    getSnpTeam(next.rivalId).then(result => result.data).catch(() => null),
    readRivalLineup(teamId, next.fixtureId).then(value => ({ value, error: "" })).catch((error: unknown) => ({ value: null, error: error instanceof Error ? error.message : "No se pudo leer la alineación guardada." })),
    clubRepository.getPlayers(teamId),
    Promise.resolve().then(() => walletStore().publishedLineup(teamId, next.fixtureId)).catch(() => null),
  ]);
  const ownPlayers: LineupPlayer[] = players.map(player => ({ id: player.id, name: withNickname(player.name, player.nickname), points: player.points, photo: cardPhoto(player), snpId: player.sourceId, snpTeam: player.sourceTeamId }));
  // Published pairs keep the builder's ids; the hidden site works with five numbered slots.
  const publishedOwn = published && emptyLineup().map((slot, index) => ({ ...slot, players: published.pairs[index]?.players ?? slot.players }));
  const rivalPlayers: LineupPlayer[] = (rival?.players ?? []).map(player => ({ id: player.id, name: player.name, points: player.points, photo: cardPhoto(player), snpId: player.id, snpTeam: next.rivalId }));
  return (
    <>
      {heading}
      {saved.error && <p className="snp-warning" role="status">{saved.error}</p>}
      {rival
        ? <HiddenSite key={`${teamId}-${next.fixtureId}`} teamId={teamId} ownName={`Fito Raya ${teamId.toUpperCase()}`} preparation={next} division={teamDivisions[teamId]} ownPlayers={ownPlayers} rivalPlayers={rivalPlayers} initialRival={saved.value} publishedOwn={publishedOwn} />
        : <section className="panel empty-state"><h2>Plantilla no disponible.</h2><p>SNP no ha devuelto la plantilla de {next.rivalName}. Vuelve a intentarlo en un rato.</p></section>}
    </>
  );
}

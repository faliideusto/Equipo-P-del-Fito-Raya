import Link from "next/link";
import { notFound } from "next/navigation";
import { cardPhoto } from "@/data/player-photos";
import { PageHeading } from "@/components/sports";
import { HiddenSite } from "@/components/hidden-site/hidden-site";
import type { LineupPlayer } from "@/components/hidden-site/types";
import { canBuildGuestPairs, GUEST_DIVISION, nextGuestRival } from "@/lib/cayitos";
import { readRivalLineup } from "@/lib/rival-lineups";
import { getSnpTeam } from "@/lib/snp-service";
import type { SnpTeam } from "@/domain/snp";

// Tomás's own hidden site: the same tools as the club's, worked out from his team (Top Bal).
// Only his account opens it, only on his own team; nobody from the club sees what he saves.
export default async function GuestHiddenSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,10}$/.test(id)) notFound();
  const back = <Link className="text-link" href={`/competicion/equipos/${id}?division=${GUEST_DIVISION}`}>← Volver a mi equipo</Link>;
  const heading = (name: string) => <PageHeading eyebrow={`${name} · Privado`} title="Sitio oculto" text="Prepara el próximo partido: la alineación que esperas del rival y cómo se cruza con la tuya." />;
  if (!(await canBuildGuestPairs(id))) return <>{heading("Equipo")}<section className="panel empty-state"><h2>Sección privada.</h2><p>Este sitio oculto no está disponible para tu cuenta.</p></section></>;
  const [own, next] = await Promise.all([
    getSnpTeam(id).then(result => result.data).catch(() => null),
    nextGuestRival(id).catch(() => null),
  ]);
  const ownName = own?.name.replaceAll("_", " ") || "Mi equipo";
  if (!next) return <>{heading(ownName)}{back}<section className="panel empty-state"><h2>No hay próximo rival.</h2><p>SNP no tiene encuentros pendientes publicados para {ownName}.</p></section></>;
  const [rival, saved] = await Promise.all([
    getSnpTeam(next.rivalId).then(result => result.data).catch(() => null),
    readRivalLineup("tomas", next.fixtureId).then(value => ({ value, error: "" })).catch((error: unknown) => ({ value: null, error: error instanceof Error ? error.message : "No se pudo leer la alineación guardada." })),
  ]);
  const players = (team: SnpTeam | null, teamId: string): LineupPlayer[] => (team?.players ?? []).map(player => ({ id: player.id, name: player.name, points: player.points, photo: cardPhoto(player), snpId: player.id, snpTeam: teamId }));
  return (
    <>
      {heading(ownName)}
      {back}
      {saved.error && <p className="snp-warning" role="status">{saved.error}</p>}
      {rival && own
        ? <HiddenSite key={`tomas-${next.fixtureId}`} teamId="tomas" ownName={ownName} preparation={next} division={GUEST_DIVISION} ownPlayers={players(own, id)} rivalPlayers={players(rival, next.rivalId)} initialRival={saved.value} publishedOwn={null} />
        : <section className="panel empty-state"><h2>Plantilla no disponible.</h2><p>SNP no ha devuelto la plantilla de {rival ? ownName : next.rivalName}. Vuelve a intentarlo en un rato.</p></section>}
    </>
  );
}

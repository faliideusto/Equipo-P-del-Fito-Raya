import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeading } from "@/components/sports";
import { SnpLineupPanel } from "@/components/snp-lineup-panel";
import { TeamLogo } from "@/components/team-logo";
import { canSeeLineupCheck } from "@/lib/cayitos";
import { actaLineups } from "@/lib/acta-lineups";
export const dynamic = "force-dynamic";
export const metadata = { title: "Comprobar alineaciones", robots: { index: false, follow: false } };

export default async function LineupCheckActa({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await canSeeLineupCheck())) notFound();
  const { id } = await params;
  if (!/^\d{1,10}$/.test(id)) notFound();
  const query = await searchParams;
  const filters = new URLSearchParams();
  for (const key of ["zone", "phase", "category", "group", "club", "division", "round"]) { const value = query[key]; if (typeof value === "string" && /^\d{1,10}$/.test(value)) filters.set(key, value); }
  const back = <Link className="text-link" href={`/comprobar-alineaciones${filters.size ? `?${filters}` : ""}`}>← Buscar otro partido</Link>;
  const result = await actaLineups(id).then(value => ({ value, error: false })).catch(() => ({ value: null, error: true }));
  if (!result.value) return <>
    <PageHeading eyebrow={`Acta SNP · ${id}`} title="Comprobar alineaciones." text={result.error ? "No se pudo leer este acta en SNP. Vuelve a intentarlo en un rato." : "Este acta no tiene partidos en SNP."}/>
    {back}
  </>;
  const { match, sides } = result.value;
  const [home, away] = sides;
  return <>
    <PageHeading eyebrow={`Acta SNP · ${id}${match?.title ? ` · ${match.title}` : ""}`} title={`${home.name} vs ${away.name}`} text={match?.dateLabel ? `${match.dateLabel}. Alineaciones sacadas de los puntos de cada jugador en el acta.` : "Alineaciones sacadas de los puntos de cada jugador en el acta."}/>
    <div className="lineup-check-links">{back}<Link className="text-link" href={`/competicion/actas/${id}${filters.size ? `?${filters}` : ""}`}>Ver el acta <ExternalLink size={14}/></Link></div>
    <div className="lineup-check">
      {sides.map((side, index) => <div key={side.teamId} className="lineup-check-side">
        <p className="lineup-check-team"><TeamLogo name={side.name}/><span><small>{index === 0 ? "Local" : "Visitante"}</small><Link href={`/competicion/equipos/${side.teamId}${filters.size ? `?${filters}` : ""}`}>{side.name}</Link></span></p>
        <SnpLineupPanel fromSnp={side.lineup} teamName={side.name} players={side.players}/>
      </div>)}
    </div>
  </>;
}

import { notFound } from "next/navigation";
import { PageHeading } from "@/components/sports";
import { CompetitionExplorer } from "@/components/competition-explorer";
import type { SnpCompetition } from "@/domain/snp";
import { canSeeLineupCheck } from "@/lib/cayitos";
import { ActaSearch } from "@/components/acta-search";
export const metadata = { title: "Comprobar alineaciones", robots: { index: false, follow: false } };

// Private to Rafael's account: find any match of SNP and see both lineups from the acta's points.
// Anyone else gets a plain 404, so the section does not show that it exists.
export default async function LineupCheckPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await canSeeLineupCheck())) notFound();
  const query = await searchParams;
  const filters: Partial<SnpCompetition["filters"]> = {};
  for (const key of ["zone", "phase", "category", "group", "club", "division", "round"] as const) { const value = query[key]; if (typeof value === "string" && /^\d{1,10}$/.test(value)) filters[key] = value; }
  return <>
    <PageHeading eyebrow="Privado · Tu cuenta" title="Comprobar alineaciones." text="Busca cualquier partido de SNP y mira las dos alineaciones, sacadas de los puntos de cada jugador en el acta."/>
    <ActaSearch/>
    <CompetitionExplorer initialFilters={filters} matchBase="/comprobar-alineaciones"/>
  </>;
}

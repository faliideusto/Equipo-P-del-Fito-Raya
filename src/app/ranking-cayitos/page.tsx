import { notFound } from "next/navigation";
import { PageHeading } from "@/components/sports";
import { CayitosRanking } from "@/components/cayitos-ranking";
import { canSeeCayitos, loadCayitos } from "@/lib/cayitos";
export const metadata = { title: "Ranking cayitos", robots: { index: false, follow: false } };
// Private: only the accounts linked to Rafael, Hugo and Dionisio. Anyone else gets a plain 404,
// so the section does not even show that it exists.
export default async function CayitosPage() {
  if (!(await canSeeCayitos())) notFound();
  const rows = await loadCayitos();
  return <>
    <PageHeading eyebrow="Privado · 4 colegas" title="Ranking cayitos." text="Rafael, Hugo, Dionisio y Tomás frente a frente con sus números de SNP."/>
    <CayitosRanking rows={rows} updatedAt={new Date().toISOString()}/>
  </>;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { clubRepository } from "@/data/repository";
import type { TeamId } from "@/domain/types";
import { getSnpMatch } from "@/lib/snp-service";
import { SnpMatchView } from "@/components/snp-match-view";
import { PageHeading } from "@/components/sports";
import { FixtureNav } from "@/components/fixture-nav";
import { MyMatchResult } from "@/components/my-match-result";
import { adjacentFixtures } from "@/domain/fixture-navigation";
export default async function FixturePage({params}:{params:Promise<{teamId:TeamId;fixtureId:string}>}){
  const {teamId,fixtureId}=await params;
  const fixtures=await clubRepository.getFixtures(teamId);
  const fixture=fixtures.find(f=>f.id===fixtureId);
  if(!fixture)notFound();
  const backHref=`/equipos/${teamId}/jornadas`;
  const nav=<FixtureNav backHref={backHref} teamId={teamId} {...adjacentFixtures(fixtures,fixtureId)}/>;
  const result=await getSnpMatch(fixtureId).catch(()=>null);
  if(result)return <SnpMatchView result={result} nav={nav} teamQuery={`division=${teamId === "a" ? "2318" : "2326"}`}><MyMatchResult teamId={teamId} fixtureId={fixtureId}/></SnpMatchView>;
  return <>{nav}<PageHeading eyebrow={`JORNADA ${fixture.round}`} title={fixture.opponent} text="El acta no está disponible en esta consulta."/><MyMatchResult teamId={teamId} fixtureId={fixtureId}/><section className="panel connection-panel"><p>SNP no ha permitido consultar las parejas y los sets. Vuelve a intentarlo más tarde.</p><Link href={`/equipos/${teamId}/parejas`} className="button secondary">Preparar parejas</Link></section></>;
}

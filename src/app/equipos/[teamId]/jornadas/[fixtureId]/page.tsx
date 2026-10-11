import Link from "next/link";
import { notFound } from "next/navigation";
import { clubRepository } from "@/data/repository";
import type { TeamId } from "@/domain/types";
import { getSnpMatch } from "@/lib/snp-service";
import { SnpMatchView } from "@/components/snp-match-view";
import { PageHeading } from "@/components/sports";
import { FixtureNav } from "@/components/fixture-nav";
import { adjacentFixtures } from "@/domain/fixture-navigation";
import { currentAccount } from "@/lib/account-auth";
import { playerLink } from "@/lib/account-profile";
import { fixtureProvisional } from "@/lib/pending-results-service";
export default async function FixturePage({params}:{params:Promise<{teamId:TeamId;fixtureId:string}>}){
  const {teamId,fixtureId}=await params;
  const fixtures=await clubRepository.getFixtures(teamId);
  const fixture=fixtures.find(f=>f.id===fixtureId);
  if(!fixture)notFound();
  const backHref=`/equipos/${teamId}/jornadas`;
  const nav=<FixtureNav backHref={backHref} teamId={teamId} {...adjacentFixtures(fixtures,fixtureId)}/>;
  const result=await getSnpMatch(fixtureId).catch(()=>null);
  if(result){
    const user=await currentAccount().catch(()=>null);
    const link=user&&user.role!=="coach"&&user.role!=="visitor"?await playerLink(user.id).catch(()=>null):null;
    const provisional=await fixtureProvisional(link?user!.id:null,link?.player_id??null,teamId,fixture,result.data.teamIds);
    return <SnpMatchView result={result} nav={nav} provisional={provisional} teamQuery={`division=${teamId === "a" ? "2318" : "2326"}`}/>;
  }
  return <>{nav}<PageHeading eyebrow={`JORNADA ${fixture.round}`} title={fixture.opponent} text="El acta no está disponible en esta consulta."/><section className="panel connection-panel"><p>SNP no ha permitido consultar las parejas y los sets. Vuelve a intentarlo más tarde.</p><Link href={`/equipos/${teamId}/parejas`} className="button secondary">Preparar parejas</Link></section></>;
}

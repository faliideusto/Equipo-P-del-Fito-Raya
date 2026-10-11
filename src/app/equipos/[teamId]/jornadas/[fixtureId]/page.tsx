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
  // The acta and the user's identity are independent: load them in parallel.
  const [result,identity]=await Promise.all([getSnpMatch(fixtureId).catch(()=>null),currentAccount().then(async user=>user&&user.role!=="coach"&&user.role!=="visitor"?{user,link:await playerLink(user.id)}:null).catch(()=>null)]);
  if(result){
    const link=identity?.link;
    const provisional=await fixtureProvisional(link?identity.user.id:null,link?.player_id??null,teamId,fixture,result.data);
    return <SnpMatchView result={result} nav={nav} provisional={provisional} teamQuery={`division=${teamId === "a" ? "2318" : "2326"}`}/>;
  }
  return <>{nav}<PageHeading eyebrow={`JORNADA ${fixture.round}`} title={fixture.opponent} text="El acta no está disponible en esta consulta."/><section className="panel connection-panel"><p>SNP no ha permitido consultar las parejas y los sets. Vuelve a intentarlo más tarde.</p><Link href={`/equipos/${teamId}/parejas`} className="button secondary">Preparar parejas</Link></section></>;
}

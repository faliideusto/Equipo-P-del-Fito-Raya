import Link from "next/link";
import { ViewTransition } from "react";
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
import { shareableTeams } from "@/lib/team-captains";
import { teamResultMessage } from "@/lib/team-result-service";
import { TeamResultCard } from "@/components/team-result-share";
export default async function FixturePage({params}:{params:Promise<{teamId:TeamId;fixtureId:string}>}){
  const {teamId,fixtureId}=await params;
  const fixtures=await clubRepository.getFixtures(teamId);
  const fixture=fixtures.find(f=>f.id===fixtureId);
  if(!fixture)notFound();
  const backHref=`/equipos/${teamId}/jornadas`;
  const nav=<FixtureNav backHref={backHref} teamId={teamId} {...adjacentFixtures(fixtures,fixtureId)}/>;
  // The acta and the user's identity are independent: load them in parallel.
  const [result,user]=await Promise.all([getSnpMatch(fixtureId).catch(()=>null),currentAccount().catch(()=>null)]);
  const [link,teams]=await Promise.all([user&&user.role!=="coach"&&user.role!=="visitor"?playerLink(user.id).catch(()=>null):null,shareableTeams(user).catch(():TeamId[]=>[])]);
  // Only the captain and the coach see the WhatsApp message, once all five pairs have a result.
  const share=teams.includes(teamId)?await teamResultMessage(teamId,fixture,result?.data??null).catch(()=>null):null;
  const card=share&&<TeamResultCard message={share}/>;
  if(result){
    const provisional=await fixtureProvisional(link&&user?user.id:null,link?.player_id??null,teamId,fixture,result.data);
    return <MatchdaySlide fixtureId={fixtureId}><SnpMatchView result={result} nav={nav} provisional={provisional} teamQuery={`division=${teamId === "a" ? "2318" : "2326"}`}/>{card}</MatchdaySlide>;
  }
  return <MatchdaySlide fixtureId={fixtureId}>{nav}<PageHeading eyebrow={`JORNADA ${fixture.round}`} title={fixture.opponent} text="El acta no está disponible en esta consulta."/><section className="panel connection-panel"><p>SNP no ha permitido consultar las parejas y los sets. Vuelve a intentarlo más tarde.</p><Link href={`/equipos/${teamId}/parejas`} className="button secondary">Preparar parejas</Link></section>{card}</MatchdaySlide>;
}
// Previous/next arrows tag the navigation; the matchday content slides in that direction.
function MatchdaySlide({fixtureId,children}:{fixtureId:string;children:React.ReactNode}){
  const slide={"nav-forward":"nav-forward","nav-back":"nav-back",default:"none"};
  return <ViewTransition key={fixtureId} enter={slide} exit={slide} default="none"><div>{children}</div></ViewTransition>;
}

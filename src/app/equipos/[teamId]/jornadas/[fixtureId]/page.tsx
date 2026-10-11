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
import { WalletNotify } from "@/components/wallet-notify";
import { walletAvailability } from "@/lib/wallet-config";
import { notifyKindFor, usablePairs } from "@/domain/wallet-ui";
import { publishedPairs } from "@/lib/wallet-notify-service";
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
  // The captain and the coach see the WhatsApp message (once all five pairs have a result) and can correct any pair.
  const share=teams.includes(teamId)?await teamResultMessage(teamId,fixture,result?.data??null).catch(()=>null):null;
  const card=share&&<TeamResultCard message={share}/>;
  // Lineup on the next fixture, result on the last played one; only for the coach and the captain.
  const available=walletAvailability();
  const walletKind=teams.includes(teamId)&&(available.apple||available.google)?notifyKindFor(fixtures,fixtureId):null;
  // The coach builds the lineup right here, starting from the one already published for this fixture.
  const [roster,published]=walletKind==="lineup"?await Promise.all([clubRepository.getPlayers(teamId).catch(()=>[]),publishedPairs(teamId,fixtureId)]):[[],null];
  const wallet=walletKind&&<WalletNotify teamId={teamId} fixtureId={fixtureId} kind={walletKind} round={fixture.round} players={roster} publishedPairs={published?usablePairs(published,roster.map(p=>p.id)):null}/>;
  if(result){
    const provisional=await fixtureProvisional(link&&user?user.id:null,link?.player_id??null,teamId,fixture,result.data,teams.includes(teamId));
    return <MatchdaySlide fixtureId={fixtureId}><SnpMatchView result={result} nav={nav} provisional={provisional} teamQuery={`division=${teamId === "a" ? "2318" : "2326"}`}/>{card}{wallet}</MatchdaySlide>;
  }
  return <MatchdaySlide fixtureId={fixtureId}>{nav}<PageHeading eyebrow={`JORNADA ${fixture.round}`} title={fixture.opponent} text="El acta no está disponible en esta consulta."/><section className="panel connection-panel"><p>SNP no ha permitido consultar las parejas y los sets. Vuelve a intentarlo más tarde.</p><Link href={`/equipos/${teamId}/parejas`} className="button secondary">Preparar parejas</Link></section>{card}{wallet}</MatchdaySlide>;
}
// Previous/next arrows tag the navigation; the matchday content slides in that direction.
function MatchdaySlide({fixtureId,children}:{fixtureId:string;children:React.ReactNode}){
  const slide={"nav-forward":"nav-forward","nav-back":"nav-back",default:"none"};
  return <ViewTransition key={fixtureId} enter={slide} exit={slide} default="none"><div>{children}</div></ViewTransition>;
}

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ExplorerPlayer } from "@/components/explorer-player";
import { ProfileCard } from "@/components/profile-card";
import { memberId } from "@/lib/club-members";
import { clubPlayerCard } from "@/lib/player-card";
// Only club players have a card; anyone else, or an SNP failure, shows the profile without it.
async function ClubCard({id}:{id:string}){const card=await clubPlayerCard(id).catch(()=>null);return card&&<ProfileCard card={card}/>;}
export default async function Player({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params;const query=await searchParams;const {equipo}=query;
 if(!memberId(id)||(equipo&&!/^\d{1,10}$/.test(equipo)))notFound();
 const backQuery=new URLSearchParams();for(const key of ["zone","phase","category","group","club","division"]){if(query[key]&&/^\d{1,10}$/.test(query[key]))backQuery.set(key,query[key]);}
 return <ExplorerPlayer id={id} teamId={equipo} backQuery={backQuery.toString()} card={<Suspense fallback={null}><ClubCard id={id}/></Suspense>}/>;
}

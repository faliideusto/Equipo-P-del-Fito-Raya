import { notFound } from "next/navigation";
import { ExplorerPlayer } from "@/components/explorer-player";
export default async function Player({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 const {id}=await params;const query=await searchParams;const {equipo}=query;
 if(!/^\d{1,10}$/.test(id)||(equipo&&!/^\d{1,10}$/.test(equipo)))notFound();
 const backQuery=new URLSearchParams();for(const key of ["zone","phase","category","group","club","division"]){if(query[key]&&/^\d{1,10}$/.test(query[key]))backQuery.set(key,query[key]);}
 return <ExplorerPlayer id={id} teamId={equipo} backQuery={backQuery.toString()}/>;
}

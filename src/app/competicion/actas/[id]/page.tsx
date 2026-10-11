import { getSnpMatch } from "@/lib/snp-service";
import { PageHeading } from "@/components/sports";
import { notFound } from "next/navigation";
import { SnpMatchView } from "@/components/snp-match-view";
export const dynamic="force-dynamic";
export default async function Acta({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {id}=await params;if(!/^\d{1,10}$/.test(id))notFound();
 const query=await searchParams;const filters=new URLSearchParams();
 for(const key of ["zone","phase","category","group","club","division"]){const value=query[key];if(typeof value==="string"&&/^\d{1,10}$/.test(value))filters.set(key,value);}
 const teamQuery=filters.toString();
 const result=await getSnpMatch(id).catch(()=>null);
 if(result)return <SnpMatchView result={result} teamQuery={teamQuery} backHref={teamQuery?`/competicion?${teamQuery}`:"/competicion"}/>;
 return <><PageHeading eyebrow={`ACTA SNP · ${id}`} title="El encuentro, al detalle." text="No se pudo consultar este acta en SNP."/></>;
}

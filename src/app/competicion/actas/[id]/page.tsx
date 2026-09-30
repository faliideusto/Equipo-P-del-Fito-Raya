import { getSnpMatch } from "@/lib/snp-service";
import { PageHeading } from "@/components/sports";
import { notFound } from "next/navigation";
import { SnpMatchView } from "@/components/snp-match-view";
export const dynamic="force-dynamic";
export default async function Acta({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^\d{1,10}$/.test(id))notFound();
 const result=await getSnpMatch(id).catch(()=>null);
 if(result)return <SnpMatchView result={result}/>;
 return <><PageHeading eyebrow={`ACTA SNP · ${id}`} title="El encuentro, al detalle." text="No se pudo consultar este acta en SNP."/></>;
}

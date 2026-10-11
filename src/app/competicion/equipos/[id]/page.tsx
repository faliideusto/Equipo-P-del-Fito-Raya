import { ExplorerTeam } from "@/components/explorer-team";
import { notFound } from "next/navigation";
import type { SnpCompetition } from "@/domain/snp";
import { snapshotCompetition } from "@/data/snp-explorer-snapshot";
export default async function Team({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {id}=await params;if(!/^\d{1,10}$/.test(id))notFound();const query=await searchParams;
 const filters:Partial<SnpCompetition["filters"]>={};for(const key of ["zone","phase","category","group","club","division"] as const){const value=query[key];if(typeof value==="string"&&/^\d{1,10}$/.test(value))filters[key]=value;}
 if(!filters.division){for(const division of ["2318","2326"]){if(snapshotCompetition({...filters,division})?.standings.some(team=>team.teamId===id)){filters.division=division;break;}}}
 return <ExplorerTeam key={`${id}-${JSON.stringify(filters)}`} id={id} filters={filters}/>;
}

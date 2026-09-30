import { PageHeading } from "@/components/sports";
import { CompetitionExplorer } from "@/components/competition-explorer";
import type { SnpCompetition } from "@/domain/snp";
export default async function CompetitionPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams;const filters:Partial<SnpCompetition["filters"]>={};for(const key of ["zone","phase","category","group","club","division","round"] as const){const value=query[key];if(typeof value==="string"&&/^\d{1,10}$/.test(value))filters[key]=value;}
 return <><PageHeading eyebrow="SERIES NACIONALES DE PÁDEL" title="Toda la competición." text="Explora divisiones, descubre equipos y sigue cada jornada."/><CompetitionExplorer initialFilters={filters}/></>;
}

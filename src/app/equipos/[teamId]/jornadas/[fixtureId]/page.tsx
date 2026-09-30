import Link from "next/link";
import { notFound } from "next/navigation";
import { clubRepository } from "@/data/repository";
import type { TeamId } from "@/domain/types";
import { getSnpMatch } from "@/lib/snp-service";
import { SnpMatchView } from "@/components/snp-match-view";
import { PageHeading } from "@/components/sports";
export default async function FixturePage({params}:{params:Promise<{teamId:TeamId;fixtureId:string}>}){
  const {teamId,fixtureId}=await params;
  const fixture=(await clubRepository.getFixtures(teamId)).find(f=>f.id===fixtureId);
  if(!fixture)notFound();
  const backHref=`/equipos/${teamId}/jornadas`;
  const result=await getSnpMatch(fixtureId).catch(()=>null);
  if(result)return <SnpMatchView result={result} backHref={backHref} backLabel="Volver al calendario"/>;
  return <><Link href={backHref} className="text-link back-link">← Volver al calendario</Link><PageHeading eyebrow={`JORNADA ${fixture.round}`} title={fixture.opponent} text="El acta no está disponible en esta consulta."/><section className="panel connection-panel"><p>Conecta SNP para consultar las parejas y los sets publicados.</p><Link href="/conexion" className="button">Revisar conexión</Link><Link href={`/equipos/${teamId}/parejas`} className="button secondary">Preparar parejas</Link></section></>;
}

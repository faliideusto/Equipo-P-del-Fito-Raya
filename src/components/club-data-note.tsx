import type { TeamId } from "@/domain/types";
import { getSnpCompetition,getSnpTeam } from "@/lib/snp-service";
import { connection } from "next/server";
export async function ClubDataNote({teamId}:{teamId:TeamId}){
  await connection();
  const [team,competition]=await Promise.all([getSnpTeam(teamId==="a"?"7778":"803902"),getSnpCompetition({division:teamId==="a"?"2318":"2326"})]);
  const updatedAt=[team,competition].map(result=>result.updatedAt).sort()[0];
  return <p className="data-note">Datos de SNP · Consulta: {new Date(updatedAt).toLocaleString("es-ES",{timeZone:"Europe/Madrid"})}.</p>;
}

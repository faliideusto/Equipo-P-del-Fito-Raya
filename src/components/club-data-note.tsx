import type { TeamId } from "@/domain/types";
import { getSnpCompetition,getSnpTeam } from "@/lib/snp-service";
import { connection } from "next/server";
import { clubDivision } from "@/lib/club-division";
export async function ClubDataNote({teamId}:{teamId:TeamId}){
  await connection();
  const [team,competition]=await Promise.all([getSnpTeam(teamId==="a"?"7778":"803902"),clubDivision(teamId).then(division=>getSnpCompetition({division}))]);
  const updatedAt=[team,competition].map(result=>result.updatedAt).sort()[0];
  return <p className="data-note">Datos de SNP · Consulta: {new Date(updatedAt).toLocaleString("es-ES",{timeZone:"Europe/Madrid"})}.</p>;
}

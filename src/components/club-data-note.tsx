import Link from "next/link";
import type { TeamId } from "@/domain/types";
import { getSnpCompetition,getSnpTeam } from "@/lib/snp-service";
import { connection } from "next/server";
export async function ClubDataNote({teamId}:{teamId:TeamId}){
  await connection();
  const [team,competition]=await Promise.all([getSnpTeam(teamId==="a"?"7778":"803902"),getSnpCompetition({division:teamId==="a"?"2318":"2326"})]);
  const results=[team,competition];const stale=results.find(r=>r.stale);
  return <p className={stale?"snp-warning":"data-note"} role="status">{stale?`Datos guardados · ${stale.error||"SNP no está disponible."}`:"Datos consultados directamente en SNP."} <span>Consulta: {new Date((stale||competition).updatedAt).toLocaleString("es-ES",{timeZone:"Europe/Madrid"})}.</span>{stale&&<Link href="/conexion"> Revisar conexión →</Link>}</p>;
}

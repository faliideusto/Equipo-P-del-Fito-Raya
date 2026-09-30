import { getSnpCompetition,getSnpTeam } from "../src/lib/snp-service";
async function sync(){
  try {process.loadEnvFile(".env.local");} catch { /* Hosting injects secrets directly. */ }
  const jobs=await Promise.allSettled([getSnpTeam("7778",true),getSnpTeam("803902",true),getSnpCompetition({division:"2318"},true),getSnpCompetition({division:"2326"},true)]);
  const failed=jobs.some(r=>r.status==="rejected"||r.value.stale);
  console.log(failed?"No se completó la sincronización. Se conservan los últimos datos válidos.":"Plantillas, clasificación y calendario de A y B actualizados directamente desde SNP.");
  if(failed)process.exitCode=1;
}
sync().catch(()=>{console.error("No se pudo completar la sincronización SNP.");process.exitCode=1;});

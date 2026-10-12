import { getSnpCompetition, getSnpTeam } from "@/lib/snp-service";
import { hasSnpSession } from "@/lib/snp-client";
import { expireSnpCache } from "@/lib/snp-cache";
import { allowForcedRefresh } from "@/lib/snp-refresh-limit";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");const host=request.headers.get("host");
  let sameOrigin=false;try {sameOrigin=new URL(origin||"").host===host;}catch {}
  if (!sameOrigin) return Response.json({error:"Origen no válido."},{status:403});
  if (!(await hasSnpSession())) return Response.json({error:"Conecta SNP para activar la actualización automática."},{status:409});
  // Manual "Actualizar" buttons force a SNP read, at most once every 30 s for everyone.
  const force=new URL(request.url).searchParams.get("refresh")==="1"&&allowForcedRefresh("sync");
  if (force) await expireSnpCache();
  const results = await Promise.allSettled([getSnpTeam("7778",force),getSnpTeam("803902",force),getSnpCompetition({division:"2318"},force),getSnpCompetition({division:"2326"},force)]);
  const warnings = results.flatMap(result=>result.status==="rejected"?["No se completó una consulta SNP."]:result.value.stale?[result.value.error||"Se conserva la última consulta."]:[]);
  // The client only re-renders the page when SNP returned something new.
  const changed = results.some(result=>result.status==="fulfilled"&&result.value.changed===true);
  return Response.json({ok:warnings.length===0,changed:changed||force,warnings});
}

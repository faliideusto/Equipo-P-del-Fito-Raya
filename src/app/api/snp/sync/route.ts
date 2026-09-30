import { getSnpCompetition, getSnpTeam } from "@/lib/snp-service";
import { hasSnpSession } from "@/lib/snp-client";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");const host=request.headers.get("host");
  let sameOrigin=false;try {sameOrigin=new URL(origin||"").host===host;}catch {}
  if (!sameOrigin) return Response.json({error:"Origen no válido."},{status:403});
  if (!(await hasSnpSession())) return Response.json({error:"Conecta SNP para activar la actualización automática."},{status:409});
  const force=process.env.NODE_ENV!=="production"&&new URL(request.url).searchParams.get("refresh")==="1";
  const results = await Promise.allSettled([getSnpTeam("7778",force),getSnpTeam("803902",force),getSnpCompetition({division:"2318"},force),getSnpCompetition({division:"2326"},force)]);
  const warnings = results.flatMap(result=>result.status==="rejected"?["No se completó una consulta SNP."]:result.value.stale?[result.value.error||"Se conserva la última consulta."]:[]);
  return Response.json({ok:warnings.length===0,warnings});
}

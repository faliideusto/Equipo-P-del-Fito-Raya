import { getSnpCompetition, validId, withTeamChallenge } from "@/lib/snp-service";
import { allowForcedRefresh } from "@/lib/snp-refresh-limit";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query=Object.fromEntries(["zone","phase","category","group","club","division","round"].flatMap(key=>params.has(key)?[[key,params.get(key)!]]:[]));
  const force=params.get("refresh")==="1"&&allowForcedRefresh("competition:"+JSON.stringify(query));
  try {
    const team=params.get("team");
    const result=await getSnpCompetition(query,force);
    return Response.json(team?await withTeamChallenge(result,validId(team)):result,{headers:{"Cache-Control":"no-store"}});
  }
  catch(error) { return Response.json({error:error instanceof Error?error.message:"No se pudo consultar SNP."},{status:503}); }
}

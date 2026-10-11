import { getSnpTeam } from "@/lib/snp-service";
import { allowForcedRefresh } from "@/lib/snp-refresh-limit";
export const dynamic = "force-dynamic";
export async function GET(request: Request,{params}:{params:Promise<{id:string}>}) {
  try { const {id}=await params; const force=new URL(request.url).searchParams.get("refresh")==="1"&&allowForcedRefresh("team:"+id); return Response.json(await getSnpTeam(id,force),{headers:{"Cache-Control":"no-store"}}); }
  catch(error) {return Response.json({error:error instanceof Error?error.message:"No se pudo consultar el equipo."},{status:503});}
}

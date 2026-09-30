import { getSnpTeam } from "@/lib/snp-service";
export const dynamic = "force-dynamic";
export async function GET(request: Request,{params}:{params:Promise<{id:string}>}) {
  try { const {id}=await params; return Response.json(await getSnpTeam(id,new URL(request.url).searchParams.get("refresh")==="1"),{headers:{"Cache-Control":"no-store"}}); }
  catch(error) {return Response.json({error:error instanceof Error?error.message:"No se pudo consultar el equipo."},{status:503});}
}

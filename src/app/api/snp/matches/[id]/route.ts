import { getSnpMatch } from "@/lib/snp-service";
export const dynamic = "force-dynamic";
export async function GET(_request: Request,{params}:{params:Promise<{id:string}>}) {
  try { const {id}=await params; return Response.json(await getSnpMatch(id),{headers:{"Cache-Control":"no-store"}}); }
  catch(error) {return Response.json({error:error instanceof Error?error.message:"No se pudo consultar el acta."},{status:503});}
}

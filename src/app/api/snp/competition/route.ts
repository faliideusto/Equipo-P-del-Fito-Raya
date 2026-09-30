import { getSnpCompetition } from "@/lib/snp-service";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try { return Response.json(await getSnpCompetition(Object.fromEntries(["zone","phase","category","group","club","division","round"].flatMap(key=>params.has(key)?[[key,params.get(key)!]]:[])),params.get("refresh")==="1"),{headers:{"Cache-Control":"no-store"}}); }
  catch(error) { return Response.json({error:error instanceof Error?error.message:"No se pudo consultar SNP."},{status:503}); }
}

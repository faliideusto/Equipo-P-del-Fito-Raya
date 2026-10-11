import { NextRequest,NextResponse } from "next/server";
import { getSnpPlayer } from "@/lib/snp-service";
import { allowForcedRefresh } from "@/lib/snp-refresh-limit";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  try{const team=request.nextUrl.searchParams.get("team")||undefined;const group=request.nextUrl.searchParams.get("group")||undefined;const force=request.nextUrl.searchParams.get("refresh")==="1"&&allowForcedRefresh(`player:${id}:${team??""}:${group??""}`);return NextResponse.json(await getSnpPlayer(id,team,group,force),{headers:{"Cache-Control":"no-store"}});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"No se pudo consultar el jugador."},{status:503});}
}

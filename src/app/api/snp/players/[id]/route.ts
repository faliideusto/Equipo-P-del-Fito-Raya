import { NextRequest,NextResponse } from "next/server";
import { getSnpPlayer } from "@/lib/snp-service";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  try{return NextResponse.json(await getSnpPlayer(id,request.nextUrl.searchParams.get("team")||undefined,request.nextUrl.searchParams.get("group")||undefined,request.nextUrl.searchParams.get("refresh")==="1"),{headers:{"Cache-Control":"no-store"}});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"No se pudo consultar el jugador."},{status:503});}
}

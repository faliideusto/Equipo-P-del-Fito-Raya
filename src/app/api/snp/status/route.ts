import { hasSnpSession } from "@/lib/snp-client";
import { cacheStatus } from "@/lib/snp-cache";
import { readFile } from "node:fs/promises";
export const dynamic = "force-dynamic";
export async function GET() {
  let login: {state:string;message:string;updatedAt:string}|null=null;
  try {const value=JSON.parse(await readFile(".snp-private/login-status.json","utf8"));if(Date.now()-Date.parse(value.updatedAt)<20*60*1000)login=value;}catch{}
  return Response.json({configured:await hasSnpSession(),...cacheStatus(),login,mode:process.env.SNP_EMAIL&&process.env.SNP_PASSWORD?"credentials":"session",localLogin:process.env.NODE_ENV!=="production",interval:Math.max(30,Number(process.env.SNP_CACHE_SECONDS)||60)},{headers:{"Cache-Control":"no-store"}});
}

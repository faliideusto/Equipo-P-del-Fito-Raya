import { spawn } from "node:child_process";
import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
const runtime = globalThis as typeof globalThis & { snpLoginRunning?: boolean };
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  let local = false;
  try { const source=new URL(origin||""); local=["localhost","127.0.0.1"].includes(source.hostname)&&source.host===host; } catch {}
  if (!local) return Response.json({error:"El inicio de sesión solo está disponible en este ordenador."},{status:403});
  if (process.env.NODE_ENV === "production") return Response.json({error:"Renueva la sesión desde el equipo del administrador y carga el archivo privado en el servidor."},{status:403});
  if (runtime.snpLoginRunning) return Response.json({started:true});
  runtime.snpLoginRunning = true;
  await mkdir(".snp-private",{recursive:true});
  await writeFile(".snp-private/login-status.json",JSON.stringify({state:"starting",message:"Abriendo la ventana de SNP…",updatedAt:new Date().toISOString()}),{mode:0o600});
  const child = spawn(process.execPath,[path.resolve("scripts/snp-login.mjs")],{cwd:process.cwd(),stdio:"ignore",windowsHide:true});
  child.on("exit",()=>{runtime.snpLoginRunning=false;}); child.on("error",()=>{runtime.snpLoginRunning=false;void writeFile(".snp-private/login-status.json",JSON.stringify({state:"error",message:"No se pudo iniciar el asistente de conexión.",updatedAt:new Date().toISOString()}),{mode:0o600});});
  return Response.json({started:true});
}

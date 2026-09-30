import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { TeamId } from "@/domain/types";
export type MvpAward = { team_id: TeamId; month: string; player_id: string; source_id: string; name: string; photo_url: string | null; updated_at: string };
let pending: Promise<void> = Promise.resolve();
export async function mvpAwards(award?: MvpAward): Promise<MvpAward[]> {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SECRET_KEY;
  if (url && key) {
    const endpoint = new URL("/rest/v1/monthly_mvp", url);
    if (endpoint.protocol !== "https:") throw new Error("URL no válida");
    if (award) endpoint.searchParams.set("on_conflict", "team_id,month");
    else { endpoint.searchParams.set("select", "team_id,month,player_id,source_id,name,photo_url,updated_at"); endpoint.searchParams.set("order", "month.desc,team_id.asc"); }
    const response = await fetch(endpoint, { method: award ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, ...(award ? { body: JSON.stringify(award) } : {}) });
    if (!response.ok) throw new Error("No se pudo consultar MVP. Comprueba que se haya creado la tabla monthly_mvp en Supabase.");
    return award ? mvpAwards() : response.json();
  }
  if (process.env.RENDER === "true" || url || key) throw new Error("Configura Supabase para conservar los MVP.");
  const file = ".club-private/mvp.json";
  async function read(): Promise<MvpAward[]> { try { return JSON.parse(await readFile(file, "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; } }
  if (award) { const operation = pending.then(async () => { const rows = (await read()).filter(row => row.team_id !== award.team_id || row.month !== award.month); rows.push(award); await mkdir(".club-private", { recursive: true }); const tmp = `${file}.${randomUUID()}.tmp`; await writeFile(tmp, JSON.stringify(rows), { mode: 0o600 }); await rename(tmp, file); }); pending = operation.catch(() => {}); await operation; }
  return (await read()).sort((a, b) => b.month.localeCompare(a.month) || a.team_id.localeCompare(b.team_id));
}

import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Pair, TeamId } from "@/domain/types";
export type SavedLineup = { id: string; team_id: TeamId; name: string; pairs: Pair[]; created_at: string };
let pending: Promise<void> = Promise.resolve();
export async function lineups(team: TeamId, action: "list" | "save" | "delete", value?: SavedLineup, id?: string): Promise<SavedLineup[]> {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SECRET_KEY;
  if (url && key) {
    const endpoint = new URL("/rest/v1/saved_lineups", url);
    if (endpoint.protocol !== "https:") throw new Error("URL no válida");
    endpoint.searchParams.set("team_id", `eq.${team}`);
    if (action === "delete") endpoint.searchParams.set("id", `eq.${id}`);
    if (action === "list") { endpoint.searchParams.set("select", "id,team_id,name,pairs,created_at"); endpoint.searchParams.set("order", "created_at.desc"); }
    const response = await fetch(endpoint, { method: action === "list" ? "GET" : action === "save" ? "POST" : "DELETE", cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json" }, ...(action === "save" ? { body: JSON.stringify(value) } : {}) });
    if (!response.ok) throw new Error("No se pudo acceder a las alineaciones. Comprueba que se haya creado la tabla saved_lineups en Supabase.");
    return action === "list" ? response.json() : lineups(team, "list");
  }
  if (process.env.RENDER === "true" || url || key) throw new Error("Configura Supabase para conservar las alineaciones.");
  const file = ".club-private/lineups.json";
  async function read(): Promise<SavedLineup[]> { try { return JSON.parse(await readFile(file, "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; } }
  if (action !== "list") {
    const operation = pending.then(async () => { const rows = await read(); const next = action === "save" ? [...rows, value!] : rows.filter(row => row.team_id !== team || row.id !== id); await mkdir(".club-private", { recursive: true }); const tmp = `${file}.${randomUUID()}.tmp`; await writeFile(tmp, JSON.stringify(next), { mode: 0o600 }); await rename(tmp, file); });
    pending = operation.catch(() => {}); await operation;
  }
  return (await read()).filter(row => row.team_id === team).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

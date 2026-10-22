import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Pair, TeamId } from "@/domain/types";

// The rival lineup the coach and captains expect for each club fixture, and the lineup of ours they
// plan to face it with. Only the server reads or writes it.
export type RivalLineup = { team_id: TeamId; fixture_id: string; rival_id: string; pairs: Pair[]; own_pairs: Pair[] | null; updated_at: string };
export class MissingRivalLineupsTable extends Error {}
const file = () => path.resolve(process.env.RIVAL_LINEUPS_FILE || ".club-private/rival-lineups.json");
let pending: Promise<void> = Promise.resolve();
function local() {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SECRET_KEY;
  if (url && key) return false;
  if (process.env.RENDER === "true" || process.env.VERCEL === "1" || url || key) throw new Error("Configura Supabase para conservar la alineación del rival.");
  return true;
}
async function request(method: "GET" | "POST" | "DELETE", params: Record<string, string>, body?: object) {
  const url = process.env.SUPABASE_URL!; const key = process.env.SUPABASE_SECRET_KEY!;
  const endpoint = new URL("/rest/v1/rival_lineups", url);
  if (endpoint.protocol !== "https:") throw new Error("URL no válida");
  for (const [k, v] of Object.entries(params)) endpoint.searchParams.set(k, v);
  const response = await fetch(endpoint, { method, cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (response.status === 404) { const error = await response.json().catch(() => ({})); if (error.code === "PGRST205" || error.code === "42P01") throw new MissingRivalLineupsTable("Falta la tabla rival_lineups. Ejecuta supabase/rival-lineups.sql en Supabase."); }
  // 42703: the table was created before the column for our lineup.
  if (response.status === 400) { const error = await response.json().catch(() => ({})); if (error.code === "42703" || error.code === "PGRST204") throw new MissingRivalLineupsTable("Falta una columna en rival_lineups. Vuelve a ejecutar supabase/rival-lineups.sql en Supabase."); }
  if (!response.ok) throw new Error("No se pudo acceder a la alineación del rival.");
  return method === "GET" ? response.json() : null;
}
async function readLocal(): Promise<RivalLineup[]> { try { return JSON.parse(await readFile(file(), "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; } }
async function writeLocal(change: (rows: RivalLineup[]) => RivalLineup[]) {
  const operation = pending.then(async () => { const rows = change(await readLocal()); await mkdir(path.dirname(file()), { recursive: true }); const tmp = `${file()}.${randomUUID()}.tmp`; await writeFile(tmp, JSON.stringify(rows), { mode: 0o600 }); await rename(tmp, file()); });
  pending = operation.catch(() => {}); await operation;
}
export async function readRivalLineup(teamId: TeamId, fixtureId: string): Promise<RivalLineup | null> {
  const rows: RivalLineup[] = local()
    ? (await readLocal()).filter(row => row.team_id === teamId && row.fixture_id === fixtureId)
    : await request("GET", { select: "team_id,fixture_id,rival_id,pairs,own_pairs,updated_at", team_id: `eq.${teamId}`, fixture_id: `eq.${fixtureId}` });
  return rows[0] ? { ...rows[0], own_pairs: rows[0].own_pairs ?? null } : null;
}
export async function saveRivalLineup(row: Omit<RivalLineup, "updated_at">): Promise<RivalLineup> {
  const saved: RivalLineup = { ...row, updated_at: new Date().toISOString() };
  if (!local()) await request("POST", { on_conflict: "team_id,fixture_id" }, saved);
  else await writeLocal(rows => [...rows.filter(r => r.team_id !== row.team_id || r.fixture_id !== row.fixture_id), saved]);
  return saved;
}
export async function clearRivalLineup(teamId: TeamId, fixtureId: string) {
  if (!local()) await request("DELETE", { team_id: `eq.${teamId}`, fixture_id: `eq.${fixtureId}` });
  else await writeLocal(rows => rows.filter(r => r.team_id !== teamId || r.fixture_id !== fixtureId));
}

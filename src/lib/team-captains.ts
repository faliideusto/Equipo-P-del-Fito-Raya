import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { TeamId } from "@/domain/types";
import { isTeamCaptain, type TeamCaptain } from "@/domain/team-captain";
import { playerLink } from "./account-profile";
export class MissingCaptainsTable extends Error {}
export const MAX_CAPTAINS = 4;
const FILE = ".club-private/team-captains.json";
let pending: Promise<void> = Promise.resolve();
async function request(method: "GET" | "POST" | "DELETE", params: Record<string, string>, body?: object) {
  const url = process.env.SUPABASE_URL!; const key = process.env.SUPABASE_SECRET_KEY!;
  const endpoint = new URL("/rest/v1/team_captains", url);
  if (endpoint.protocol !== "https:") throw new Error("URL no válida");
  for (const [k, v] of Object.entries(params)) endpoint.searchParams.set(k, v);
  const response = await fetch(endpoint, { method, cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (response.status === 404) { const error = await response.json().catch(() => ({})); if (error.code === "PGRST205" || error.code === "42P01") throw new MissingCaptainsTable("Falta la tabla team_captains. Ejecuta supabase/team-captains.sql en Supabase."); }
  // 42P10: the table still has the old one-captain-per-team key.
  if (response.status === 400) { const error = await response.json().catch(() => ({})); if (error.code === "42P10") throw new MissingCaptainsTable("Para tener varios capitanes por equipo, vuelve a ejecutar supabase/team-captains.sql en Supabase."); }
  if (!response.ok) throw new Error("No se pudieron consultar los capitanes.");
  return method === "GET" ? response.json() : null;
}
function local() {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SECRET_KEY;
  if (url && key) return false;
  if (process.env.RENDER === "true" || process.env.VERCEL === "1" || url || key) throw new Error("Configura Supabase para conservar los capitanes.");
  return true;
}
async function readLocal(): Promise<TeamCaptain[]> { try { return JSON.parse(await readFile(FILE, "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; } }
export async function listCaptains(): Promise<TeamCaptain[]> {
  return local() ? readLocal() : request("GET", { select: "team_id,player_id,updated_at", order: "team_id.asc" });
}
async function writeLocal(change: (rows: TeamCaptain[]) => TeamCaptain[]) {
  const operation = pending.then(async () => { const rows = change(await readLocal()); await mkdir(".club-private", { recursive: true }); const tmp = `${FILE}.${randomUUID()}.tmp`; await writeFile(tmp, JSON.stringify(rows), { mode: 0o600 }); await rename(tmp, FILE); });
  pending = operation.catch(() => {}); await operation;
}
// A team can have several captains; adding one that already is a captain changes nothing.
export async function addCaptain(teamId: TeamId, playerId: string): Promise<TeamCaptain[]> {
  const row: TeamCaptain = { team_id: teamId, player_id: playerId, updated_at: new Date().toISOString() };
  if (!local()) await request("POST", { on_conflict: "team_id,player_id" }, row);
  else await writeLocal(rows => [...rows.filter(r => r.team_id !== teamId || r.player_id !== playerId), row]);
  return listCaptains();
}
export async function removeCaptain(teamId: TeamId, playerId: string): Promise<TeamCaptain[]> {
  if (!local()) await request("DELETE", { team_id: `eq.${teamId}`, player_id: `eq.${playerId}` });
  else await writeLocal(rows => rows.filter(r => r.team_id !== teamId || r.player_id !== playerId));
  return listCaptains();
}
// Teams whose result message this user may share: the coach always, a player only as captain.
export async function shareableTeams(user: { id: string; role?: string } | null): Promise<TeamId[]> {
  if (!user || user.role === "visitor") return [];
  if (user.role === "coach") return ["a", "b"];
  const link = await playerLink(user.id).catch(() => null); if (!link) return [];
  const captains = await listCaptains().catch(() => []);
  return (["a", "b"] as TeamId[]).filter(teamId => isTeamCaptain({ captains, teamId, playerId: link.player_id }));
}

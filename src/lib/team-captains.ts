import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { TeamId } from "@/domain/types";
import { devCaptainId, isTeamCaptain, type TeamCaptain } from "@/domain/team-captain";
import { clubRepository } from "@/data/repository";
import { playerLink } from "./account-profile";
export class MissingCaptainsTable extends Error {}
const FILE = ".club-private/team-captains.json";
let pending: Promise<void> = Promise.resolve();
async function request(method: "GET" | "POST" | "DELETE", params: Record<string, string>, body?: object) {
  const url = process.env.SUPABASE_URL!; const key = process.env.SUPABASE_SECRET_KEY!;
  const endpoint = new URL("/rest/v1/team_captains", url);
  if (endpoint.protocol !== "https:") throw new Error("URL no válida");
  for (const [k, v] of Object.entries(params)) endpoint.searchParams.set(k, v);
  const response = await fetch(endpoint, { method, cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (response.status === 404) { const error = await response.json().catch(() => ({})); if (error.code === "PGRST205" || error.code === "42P01") throw new MissingCaptainsTable("Falta la tabla team_captains. Ejecuta supabase/team-captains.sql en Supabase."); }
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
export async function setCaptain(teamId: TeamId, playerId: string | null): Promise<TeamCaptain[]> {
  const row: TeamCaptain | null = playerId ? { team_id: teamId, player_id: playerId, updated_at: new Date().toISOString() } : null;
  if (!local()) { if (row) await request("POST", { on_conflict: "team_id" }, row); else await request("DELETE", { team_id: `eq.${teamId}` }); return listCaptains(); }
  const operation = pending.then(async () => { const rows = (await readLocal()).filter(r => r.team_id !== teamId); if (row) rows.push(row); await mkdir(".club-private", { recursive: true }); const tmp = `${FILE}.${randomUUID()}.tmp`; await writeFile(tmp, JSON.stringify(rows), { mode: 0o600 }); await rename(tmp, FILE); });
  pending = operation.catch(() => {}); await operation; return listCaptains();
}
// Teams whose result message this user may share: the coach always, a player only as captain.
export async function shareableTeams(user: { id: string; role?: string } | null): Promise<TeamId[]> {
  if (!user || user.role === "visitor") return [];
  if (user.role === "coach") return ["a", "b"];
  const link = await playerLink(user.id).catch(() => null); if (!link) return [];
  const captains = await listCaptains().catch(() => []);
  const dev = devCaptainId(process.env) === link.player_id;
  const teams = await Promise.all((["a", "b"] as TeamId[]).map(async teamId => {
    const onRoster = dev && (await clubRepository.getPlayers(teamId).catch(() => [])).some(p => p.sourceId === link.player_id);
    return isTeamCaptain({ captains, teamId, playerId: link.player_id, onRoster, env: process.env }) ? teamId : null;
  }));
  return teams.filter((t): t is TeamId => t !== null);
}

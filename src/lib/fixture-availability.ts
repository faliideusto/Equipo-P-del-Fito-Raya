import type { TeamId } from "@/domain/types";
import { accountConfig, AccountError } from "./account-auth";
const MISSING = "Falta la tabla de jugadores disponibles. Ejecuta supabase/fixture-availability.sql en Supabase.";
// Who signed up for each fixture, kept per team and fixture so the coach and the captains share one list.
async function rest(method: "GET" | "POST", params: Record<string, string>, body?: object, fetchImpl: typeof fetch = fetch) {
  const { url, key } = accountConfig();
  const endpoint = new URL("/rest/v1/fixture_availability", url);
  for (const [k, v] of Object.entries(params)) endpoint.searchParams.set(k, v);
  const response = await fetchImpl(endpoint, { method, cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (response.status === 404) { const error = await response.json().catch(() => ({})); if (error.code === "PGRST205" || error.code === "42P01") throw new AccountError(MISSING, 503); }
  if (!response.ok) throw new AccountError("No se pudo acceder a los jugadores disponibles.", 503);
  return method === "GET" ? response.json() : null;
}
// null when nothing was saved yet, or when the list cannot be read: the page then starts from the whole roster.
export async function savedAvailability(teamId: TeamId, fixtureId: string, fetchImpl?: typeof fetch): Promise<string[] | null> {
  try {
    const rows: { player_ids: unknown }[] = await rest("GET", { select: "player_ids", team_id: `eq.${teamId}`, fixture_id: `eq.${fixtureId}` }, undefined, fetchImpl);
    const ids = rows[0]?.player_ids;
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : null;
  } catch { return null; }
}
export async function saveAvailability(teamId: TeamId, fixtureId: string, playerIds: string[], fetchImpl?: typeof fetch): Promise<void> {
  await rest("POST", { on_conflict: "team_id,fixture_id" }, { team_id: teamId, fixture_id: fixtureId, player_ids: playerIds, updated_at: new Date().toISOString() }, fetchImpl);
}

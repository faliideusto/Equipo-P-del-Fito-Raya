import { accountConfig, AccountError } from "./account-auth";
import type { Position } from "@/domain/types";
export type PlayerLink = { user_id: string; snp_user_id: string; player_id: string; position: Position; linked_at: string };
export function isPosition(value: unknown): value is Position { return value === "LEFT" || value === "RIGHT" || value === "BOTH"; }
export async function playerLink(userId: string, identity?: { userId: string; playerId: string; position: Position }, remove = false): Promise<PlayerLink | null> {
  const { url, key } = accountConfig();
  const endpoint = new URL(identity ? "/rest/v1/rpc/link_player_account" : "/rest/v1/player_accounts", url);
  if (!identity) { endpoint.searchParams.set("user_id", `eq.${userId}`); endpoint.searchParams.set("select", "user_id,snp_user_id,player_id,position,linked_at"); }
  const response = await fetch(endpoint, { method: remove ? "DELETE" : identity ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", Prefer: "return=representation" }, ...(identity ? { body: JSON.stringify({ p_user_id: userId, p_snp_user_id: identity.userId, p_player_id: identity.playerId, p_position: identity.position }) } : {}) });
  if (response.status === 409) throw new AccountError("Esta ficha SNP ya está vinculada a otra cuenta.", 409);
  if (!response.ok) throw new AccountError("No se pudo acceder a la vinculación. Comprueba que se haya creado la tabla player_accounts en Supabase.", 503);
  if (remove) return null;
  if (identity) return playerLink(userId);
  const rows: PlayerLink[] = await response.json(); return rows[0] ?? null;
}
export async function registeredPositions(): Promise<Record<string, Position>> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return {};
  const { url, key } = accountConfig();
  const endpoint = new URL("/rest/v1/player_accounts?select=player_id,position", url);
  try {
    const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(10000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) } });
    if (!response.ok) return {};
    const rows: Pick<PlayerLink, "player_id" | "position">[] = await response.json();
    return Object.fromEntries(rows.filter(row => isPosition(row.position)).map(row => [row.player_id, row.position]));
  } catch { return {}; }
}

import type { SnpPlayer } from "@/domain/snp";
import type { Position, TeamId } from "@/domain/types";
import { accountConfig, AccountError } from "./account-auth";

export type ClubMember = { player_id: string; name: string; name_key: string; teams: TeamId[]; points: number; photo_url: string | null };
export const localPlayerId = (id: string) => /^local-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
export const memberId = (id: string) => /^\d{1,10}$/.test(id) || localPlayerId(id);
export const nameKey = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();
export function fullPlayerName(value: unknown) {
  if (typeof value !== "string") throw new AccountError("Escribe tu nombre completo.");
  const name = value.replace(/\s+/g, " ").trim();
  if (name.length < 5 || name.length > 120 || name.split(" ").length < 2 || !/^[\p{L}\p{M} .’'-]+$/u.test(name)) throw new AccountError("Escribe tu nombre y apellidos completos.");
  return name;
}
export async function memberRequest(path: string, body?: object) {
  const { url, key } = accountConfig();
  const response = await fetch(new URL(`/rest/v1/${path}`, url), { method: body ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (response.status === 409) throw new AccountError("Este jugador ya tiene cuenta. Inicia sesión con ella.", 409);
  if (!response.ok) throw new AccountError("No se pudo guardar o consultar la plantilla. Inténtalo de nuevo.", 503);
  return response;
}
export async function clubMembers(): Promise<ClubMember[]> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return [];
  return (await memberRequest("club_players?select=player_id,name,name_key,teams,points,photo_url")).json();
}
export function memberSports(member: ClubMember): SnpPlayer {
  return { id: member.player_id, name: member.name, points: member.points, photoUrl: member.photo_url, nationalRank: null, zoneRank: null };
}
export async function registerClubMember(userId: string, teamId: TeamId, player: SnpPlayer, position: Position) {
  await memberRequest("rpc/register_club_account", { p_user_id: userId, p_team_id: teamId, p_player_id: player.id, p_name: player.name, p_name_key: nameKey(player.name), p_points: player.points, p_photo_url: player.photoUrl, p_position: position });
}

import { clubRepository } from "@/data/repository";
import { accountConfig, AccountError } from "./account-auth";
import type { TeamId } from "@/domain/types";

export function requireRosterSelection(teamId: unknown, playerId: unknown): { teamId: TeamId; playerId: string } {
  if ((teamId !== "a" && teamId !== "b") || typeof playerId !== "string" || !/^\d{1,10}$/.test(playerId)) throw new AccountError("Elige tu equipo y tu jugador de la plantilla.");
  return { teamId, playerId };
}
export async function rosterPlayer(teamId: TeamId, playerId: string) {
  const player = (await clubRepository.getPlayers(teamId)).find(player => player.sourceId === playerId);
  if (!player) throw new AccountError("Ese jugador no aparece en la plantilla del equipo seleccionado.");
  return player;
}
export async function registrationRoster(teamId: TeamId) {
  const { url, key } = accountConfig();
  const [players, response] = await Promise.all([
    clubRepository.getPlayers(teamId),
    fetch(new URL("/rest/v1/player_accounts?select=player_id", url), { cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) } }),
  ]);
  if (!response.ok) throw new AccountError("No se pudo cargar la disponibilidad de jugadores. Inténtalo de nuevo.", 503);
  const claimed = new Set((await response.json() as { player_id: string }[]).map(row => row.player_id));
  return players.filter(player => player.sourceId && /^\d{1,10}$/.test(player.sourceId)).map(player => ({ id: player.sourceId!, name: player.name, available: !claimed.has(player.sourceId!) })).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

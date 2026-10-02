import { randomUUID } from "node:crypto";
import { snpClient } from "./snp-client";
import { normalizeTeamPlayer } from "./snp-team";
import { getSnpPlayer } from "./snp-service";
import { clubRepository } from "@/data/repository";
import { AccountError } from "./account-auth";
import { clubMembers, fullPlayerName, memberSports, nameKey } from "./club-members";
import type { SnpPlayer } from "@/domain/snp";

export async function searchSnpNames(name: string): Promise<SnpPlayer[]> {
  const result = await snpClient.ajax("ajaxGetAllJugadores", { filtro: name, num_pagina: "1", limite_pagina: "20", update: "1", idequipo: "", desde_clasificacion_final: "0" }, "jugador");
  if (!Array.isArray(result.entities)) throw new AccountError("No se pudo realizar la búsqueda. Puedes volver a intentarlo.", 503);
  return result.entities.map(row => normalizeTeamPlayer(row as Record<string, unknown>)).filter(player => /^\d{1,10}$/.test(player.id) && player.name).slice(0, 20);
}
export async function searchRegistrationNames(value: unknown) {
  const name = fullPlayerName(value);
  const members = await clubMembers();
  const existing = members.filter(member => member.name_key === nameKey(name)).map(memberSports);
  try {
    const found = await searchSnpNames(name);
    return { players: [...new Map([...existing, ...found].map(player => [player.id, { id: player.id, name: player.name }])).values()], unavailable: false };
  } catch { return { players: existing.map(player => ({ id: player.id, name: player.name })), unavailable: true }; }
}
export async function resolveNewMember(value: unknown, selectedId: unknown): Promise<SnpPlayer> {
  const name = fullPlayerName(value);
  const [a, b, members] = await Promise.all([clubRepository.getPlayers("a"), clubRepository.getPlayers("b"), clubMembers()]);
  const known = [...a, ...b].find(player => selectedId ? player.sourceId === selectedId : nameKey(player.name) === nameKey(name));
  if (known?.sourceId) return { id: known.sourceId, name: known.name, points: known.points ?? 0, photoUrl: known.photoUrl ?? null, nationalRank: null, zoneRank: null };
  const previous = members.find(member => selectedId ? member.player_id === selectedId : member.name_key === nameKey(name));
  if (previous) return memberSports(previous);
  let results: SnpPlayer[] = [];
  try { results = await searchSnpNames(name); }
  catch { if (selectedId) throw new AccountError("No se pudo comprobar el jugador elegido. Vuelve a buscarlo.", 503); }
  if (selectedId) {
    const player = results.find(player => player.id === selectedId);
    if (!player) throw new AccountError("Vuelve a buscar y selecciona uno de los jugadores encontrados.");
    try { const profile = await getSnpPlayer(player.id, undefined, "20"); return { ...player, points: profile.data.points, photoUrl: profile.data.photoUrl ?? player.photoUrl }; }
    catch { return player; }
  }
  if (results.some(player => nameKey(player.name) === nameKey(name))) throw new AccountError("Hemos encontrado tu nombre. Selecciona tu jugador en los resultados para evitar duplicados.");
  return { id: `local-${randomUUID()}`, name, points: 0, photoUrl: null, nationalRank: null, zoneRank: null };
}

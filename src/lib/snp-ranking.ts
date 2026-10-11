import { snpClient } from "./snp-client";
import { cachedSnp } from "./snp-cache";
import { validId } from "./snp-service";
import type { RankingHistory } from "@/domain/snp-points";
type Option = { id?: unknown; nombre?: unknown };
const phases = (value: unknown): RankingHistory["current"] => {
  const parsed = typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { return {}; } })() : value;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
};
// Historial de ranking de un jugador en el grupo del acta (Future, 500…), solo puntos y partidos.
export async function getRankingHistory(playerId: string, title: string) {
  validId(playerId);
  const groupKey = title.match(/-\s*([^-]+?)\s*-\s*\d+\s*ª\s*Divisi[oó]n/i)?.[1]?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "grupo";
  return cachedSnp<RankingHistory>(`ranking-history-${playerId}-${groupKey}`, async () => {
    const categories = await snpClient.ajax("ajaxGetCategoriaGrupoByJugador", { idjugador: playerId }, "ranking");
    const groups = (Array.isArray(categories.grupos_select) ? categories.grupos_select : Object.values(categories.grupos_select || {})) as Option[];
    const group = groups.find(g => typeof g.nombre === "string" && new RegExp(`-\\s*${g.nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*-`, "i").test(title)) ?? groups[0];
    if (!group || !/^\d+$/.test(String(group.id))) return { current: {}, previous: {} };
    const ranking = await snpClient.ajax("ajaxGetByJugadorAndGrupo", { idjugador: playerId, idgrupo: String(group.id) }, "ranking");
    const keep = (value: unknown) => Object.fromEntries(Object.entries(phases(value)).map(([id, phase]) => [id, { nombre: phase.nombre, j_a: phase.j_a, J: phase.J }]));
    return { current: keep(ranking.datos), previous: keep(ranking.datos_ant) };
  });
}

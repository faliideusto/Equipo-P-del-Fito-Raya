import type { SnpMatch } from "./snp";
import type { Pair, TeamId } from "./types";
import type { SetScore } from "./match-result";
import { MATCH_VALUES } from "./rules";
import { toActaSets } from "./result-edit";
export type TeamResultPair = { index: number; sets: SetScore[]; names: string[] };
const PARTICLES = new Set(["de", "del", "la", "las", "los", "y"]);
// SNP mixes "JOSE LUIS NARBONA" and "hugo monroux": write every name as "Jose Luis Narbona".
export function displayName(name: string) {
  return name.trim().split(/\s+/).map((word, i) => word.toLocaleLowerCase("es").split("-").map(part => i > 0 && PARTICLES.has(part) ? part : part.charAt(0).toLocaleUpperCase("es") + part.slice(1)).join("-")).join(" ");
}
// The five pairs from our side: app results first, otherwise sets published by SNP.
export function teamResultPairs({ appResults, acta, ownSide, submitterNames }: { appResults: Record<number, SetScore[]>; acta: SnpMatch | null; ownSide: 0 | 1; submitterNames: Record<number, string> }): TeamResultPair[] | null {
  const pairs: TeamResultPair[] = [];
  for (let index = 1; index <= MATCH_VALUES.length; index++) {
    const game = acta?.games.find(g => g.index === index - 1);
    const sets = appResults[index] ?? (game?.sets.length ? toActaSets(game.sets, ownSide) : null);
    if (!sets) return null;
    const lineup = game ? (ownSide === 0 ? game.home?.map(p => p.name) ?? game.homePlayers : game.away?.map(p => p.name) ?? game.awayPlayers).filter(Boolean) : [];
    pairs.push({ index, sets, names: (lineup.length ? lineup : submitterNames[index] ? [submitterNames[index]] : []).map(displayName) });
  }
  return pairs;
}
const won = (sets: SetScore[]) => sets.filter(([a, b]) => a > b).length > sets.length / 2;
export function teamScore(pairs: TeamResultPair[]): [number, number] {
  let ours = 0, theirs = 0;
  for (const pair of pairs) { const value = MATCH_VALUES[pair.index - 1]; if (won(pair.sets)) ours += value; else theirs += value; }
  return [ours, theirs];
}
function dateLine(date: string) {
  const time = Date.parse(date); if (!date || Number.isNaN(time)) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Madrid" }).formatToParts(new Date(time)).map(p => [p.type, p.value]));
  const day = `${parts.weekday.charAt(0).toUpperCase()}${parts.weekday.slice(1).replace(".", "")} ${parts.day}/${parts.month}`;
  const hour = date.includes("T") ? new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(time)) : null;
  return `📅 ${day}${hour ? ` · ${hour}` : ""}`;
}
export function buildTeamResultMessage({ round, teamId, opponent, home, date, pairs }: { round: number; teamId: TeamId; opponent: string; home: boolean; date: string; pairs: TeamResultPair[] }) {
  const [ours, theirs] = teamScore(pairs);
  const score = `${ours}–${theirs}`;
  const result = ours > theirs ? `🏆 *¡VICTORIA ${score}!*` : ours < theirs ? `😔 *DERROTA ${score}*` : `🤝 *EMPATE ${score}*`;
  const header = [`🎾 *Jornada ${round} · Fito Raya ${teamId.toUpperCase()}*`, `🆚 ${opponent} · ${home ? "🏠 Local" : "✈️ Visitante"}`, dateLine(date)].filter((line): line is string => line !== null);
  const blocks = pairs.map(pair => [`*Pareja ${pair.index}* (${MATCH_VALUES[pair.index - 1]} pts) ${won(pair.sets) ? "✅" : "❌"}`, ...(pair.names.length ? [pair.names.join(" / ")] : []), pair.sets.map(s => s.join("-")).join(" · ")].join("\n"));
  return [header.join("\n"), result, ...blocks, "💪 ¡Vamos Fito Raya!"].join("\n\n");
}
// The lineup for the group: only pairs with someone in them, numbered in the order given (already sorted by SNP points).
// Away matches add the venue from the SNP acta and a Google Maps search for it.
export function buildLineupMessage({ round, teamId, opponent, home, date, pairs, players, venue = null }: { round: number; teamId: TeamId; opponent: string; home: boolean; date: string; pairs: Pair[]; players: { id: string; name: string }[]; venue?: string | null }) {
  const place = !home && venue ? `📍 ${venue}\n${mapsSearchUrl(venue)}` : null;
  const header = [`🎾 *Convocatoria · Jornada ${round} · Fito Raya ${teamId.toUpperCase()}*`, `🆚 ${opponent.replaceAll("_", " ")} · ${home ? "🏠 Local" : "✈️ Visitante"}`, dateLine(date), place].filter((line): line is string => line !== null);
  const blocks = pairs.flatMap((pair, index) => {
    const names = pair.players.flatMap(id => { const player = id === null ? undefined : players.find(p => p.id === id); return player ? [displayName(player.name)] : []; });
    return names.length ? [`*Pareja ${index + 1}* (${MATCH_VALUES[index] ?? 2} pts)\n${names.join(" / ")}`] : [];
  });
  return [header.join("\n"), ...blocks, "💪 ¡Vamos Fito Raya!"].join("\n\n");
}
// Not wa.me: its redirect replaces emojis with "�" before WhatsApp opens.
// SNP gives only the club name; Google Maps finds the place from it.
export const mapsSearchUrl = (place: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
export const whatsappShareUrl = (text: string) => `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

import type { SnpMatch } from "./snp";
import type { TeamId } from "./types";
import type { SetScore } from "./match-result";
import { MATCH_VALUES } from "./rules";
import { toActaSets } from "./result-edit";
export type TeamResultPair = { index: number; sets: SetScore[]; names: string[] };
// The five pairs from our side: app results first, otherwise sets published by SNP.
export function teamResultPairs({ appResults, acta, ownSide, submitterNames }: { appResults: Record<number, SetScore[]>; acta: SnpMatch | null; ownSide: 0 | 1; submitterNames: Record<number, string> }): TeamResultPair[] | null {
  const pairs: TeamResultPair[] = [];
  for (let index = 1; index <= MATCH_VALUES.length; index++) {
    const game = acta?.games.find(g => g.index === index - 1);
    const sets = appResults[index] ?? (game?.sets.length ? toActaSets(game.sets, ownSide) : null);
    if (!sets) return null;
    const lineup = game ? (ownSide === 0 ? game.home?.map(p => p.name) ?? game.homePlayers : game.away?.map(p => p.name) ?? game.awayPlayers).filter(Boolean) : [];
    pairs.push({ index, sets, names: lineup.length ? lineup : submitterNames[index] ? [submitterNames[index]] : [] });
  }
  return pairs;
}
const won = (sets: SetScore[]) => sets.filter(([a, b]) => a > b).length > sets.length / 2;
function dateLine(date: string) {
  const time = Date.parse(date); if (!date || Number.isNaN(time)) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Madrid" }).formatToParts(new Date(time)).map(p => [p.type, p.value]));
  const day = `${parts.weekday.charAt(0).toUpperCase()}${parts.weekday.slice(1).replace(".", "")} ${parts.day}/${parts.month}`;
  const hour = date.includes("T") ? new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(time)) : null;
  return `📅 ${day}${hour ? ` · ${hour}` : ""}`;
}
export function buildTeamResultMessage({ round, teamId, opponent, home, date, pairs }: { round: number; teamId: TeamId; opponent: string; home: boolean; date: string; pairs: TeamResultPair[] }) {
  let ours = 0, theirs = 0;
  for (const pair of pairs) { const value = MATCH_VALUES[pair.index - 1]; if (won(pair.sets)) ours += value; else theirs += value; }
  const score = `${ours}–${theirs}`;
  const result = ours > theirs ? `🏆 *¡VICTORIA ${score}!*` : ours < theirs ? `😔 *DERROTA ${score}*` : `🤝 *EMPATE ${score}*`;
  const header = [`🎾 *Jornada ${round} · Fito Raya ${teamId.toUpperCase()}*`, `🆚 ${opponent} · ${home ? "🏠 Local" : "✈️ Visitante"}`, dateLine(date)].filter((line): line is string => line !== null);
  const blocks = pairs.map(pair => [`*Pareja ${pair.index}* (${MATCH_VALUES[pair.index - 1]} pts) ${won(pair.sets) ? "✅" : "❌"}`, ...(pair.names.length ? [pair.names.join(" / ")] : []), pair.sets.map(s => s.join("-")).join(" · ")].join("\n"));
  return [header.join("\n"), result, ...blocks, "💪 ¡Vamos Fito Raya!"].join("\n\n");
}
export const whatsappShareUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

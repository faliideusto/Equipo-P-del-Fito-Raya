import type { Pair } from "./types";
import { emptyLineup } from "./rules";

// SNP hides a lineup until the match, but the acta page already carries the ranking points of each
// aligned player: `partidos_json[n].datos_extra` holds `pr_j1`/`pr_j2` (home pair) or `pr_j3`/`pr_j4`
// (away pair). Matching those points against the rival's roster rebuilds its lineup.

export type ActaGame = { numero: number; homeId: string; awayId: string; extra: Record<string, unknown> };
export type RosterPoints = { id: string; points: number | null };
// A slot whose points match several players: one of them is placed and the rest are listed.
export type PointsTie = { pair: number; points: number; chosen: string; candidates: string[] };
export type LineupFromPoints = {
  status: "none" | "found";
  pairs: Pair[];
  ties: PointsTie[];
  // Points with no player in the roster (stale roster or a player SNP left out of it).
  missing: { pair: number; points: number }[];
};

// Reads the JS literal `var partidos_json = [...]` out of the acta HTML.
export function actaGames(html: string): ActaGame[] {
  const start = html.search(/var\s+partidos_json\s*=\s*\[/);
  if (start < 0) return [];
  const open = html.indexOf("[", start);
  let depth = 0; let inString = false; let end = -1;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (inString) { if (c === "\\") i++; else if (c === "\"") inString = false; continue; }
    if (c === "\"") inString = true;
    else if (c === "[" || c === "{") depth++;
    else if ((c === "]" || c === "}") && --depth === 0) { end = i; break; }
  }
  if (end < 0) return [];
  let rows: unknown;
  try { rows = JSON.parse(html.slice(open, end + 1)); } catch { return []; }
  if (!Array.isArray(rows)) return [];
  return rows.flatMap(row => {
    const numero = Number(row?.numero);
    if (!Number.isInteger(numero) || numero < 1 || numero > 5) return [];
    let extra: Record<string, unknown> = {};
    if (typeof row.datos_extra === "string") { try { const value = JSON.parse(row.datos_extra); if (value && typeof value === "object") extra = value; } catch { /* sin datos */ } }
    return [{ numero, homeId: String(row.idequipo1 ?? ""), awayId: String(row.idequipo2 ?? ""), extra }];
  });
}

const cents = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
};

// Rebuilds the rival's lineup from the points of its aligned players. Pair n of SNP goes to slot n-1.
export function lineupFromPoints(games: ActaGame[], rivalId: string, roster: RosterPoints[]): LineupFromPoints {
  const pairs = emptyLineup();
  const ties: PointsTie[] = []; const missing: LineupFromPoints["missing"] = [];
  const used = new Set<string>();
  const keys = (game: ActaGame) => game.homeId === rivalId ? ["pr_j1", "pr_j2"] : game.awayId === rivalId ? ["pr_j3", "pr_j4"] : null;
  const wanted = games.flatMap(game => {
    const fields = keys(game);
    return fields ? fields.map((key, slot) => ({ pair: game.numero, slot, value: cents(game.extra[key]) })).filter(item => item.value !== null) : [];
  });
  if (!wanted.length) return { status: "none", pairs, ties, missing };
  const byPoints = (value: number) => roster.filter(player => cents(player.points ?? 0) === value).map(player => player.id);
  // Unique matches first, so a tied slot never takes a player that only fits elsewhere.
  const ordered = [...wanted].sort((a, b) => byPoints(a.value!).length - byPoints(b.value!).length);
  for (const item of ordered) {
    const candidates = byPoints(item.value!);
    const free = candidates.filter(id => !used.has(id));
    if (!free.length) { missing.push({ pair: item.pair, points: item.value! / 100 }); continue; }
    const chosen = free[0]; used.add(chosen);
    pairs[item.pair - 1].players[item.slot] = chosen;
    if (candidates.length > 1) ties.push({ pair: item.pair, points: item.value! / 100, chosen, candidates });
  }
  ties.sort((a, b) => a.pair - b.pair); missing.sort((a, b) => a.pair - b.pair);
  return { status: "found", pairs, ties, missing };
}

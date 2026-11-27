import type { Pair } from "./types";
import { emptyLineup } from "./rules";

// SNP hides a lineup until the match, but the acta page already carries the ranking points of each
// aligned player: `partidos_json[n].datos_extra` holds `pr_j1`/`pr_j2` (home pair) or `pr_j3`/`pr_j4`
// (away pair). Matching those points against the rival's roster rebuilds its lineup.

export type ActaGame = { numero: number; homeId: string; awayId: string; extra: Record<string, unknown> };
export type RosterPoints = { id: string; points: number | null };
// A slot whose points match several players: one of them is placed and the rest are listed.
export type PointsTie = { pair: number; slot: number; points: number; chosen: string; candidates: string[] };
export type LineupFromPoints = {
  status: "none" | "found";
  pairs: Pair[];
  ties: PointsTie[];
  // Points with no player in the roster (stale roster or a player SNP left out of it).
  missing: { pair: number; slot: number; points: number }[];
  // Every player whose points fit each slot (options[pair-1][slot]); null when SNP gives no points there.
  options: (string[] | null)[][];
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
  const options: (string[] | null)[][] = pairs.map(() => [null, null]);
  if (!wanted.length) return { status: "none", pairs, ties, missing, options };
  const byPoints = (value: number) => roster.filter(player => cents(player.points ?? 0) === value).map(player => player.id);
  // Unique matches first, so a tied slot never takes a player that only fits elsewhere.
  const ordered = [...wanted].sort((a, b) => byPoints(a.value!).length - byPoints(b.value!).length);
  for (const item of ordered) {
    const candidates = byPoints(item.value!);
    options[item.pair - 1][item.slot] = candidates;
    const free = candidates.filter(id => !used.has(id));
    if (!free.length) { missing.push({ pair: item.pair, slot: item.slot, points: item.value! / 100 }); continue; }
    const chosen = free[0]; used.add(chosen);
    pairs[item.pair - 1].players[item.slot] = chosen;
    if (candidates.length > 1) ties.push({ pair: item.pair, slot: item.slot, points: item.value! / 100, chosen, candidates });
  }
  const bySlot = (a: { pair: number; slot: number }, b: { pair: number; slot: number }) => a.pair - b.pair || a.slot - b.slot;
  ties.sort(bySlot); missing.sort(bySlot);
  return { status: "found", pairs, ties, missing, options };
}

// Pairs (1-5) of a saved lineup that no longer match SNP. A player tied on points with the one SNP shows
// still matches, so picking the other tied player is not a change; a slot SNP has no player for matches anyone.
export function changedPairs(snp: LineupFromPoints, saved: Pair[]): number[] {
  if (snp.status !== "found") return [];
  const fits = (option: string[] | null, id: string | null) => !option?.length || (id !== null && option.includes(id));
  return saved.flatMap((pair, index) => {
    const [a, b] = snp.options[index] ?? [null, null];
    const [x, y] = pair.players;
    return (fits(a, x) && fits(b, y)) || (fits(a, y) && fits(b, x)) ? [] : [index + 1];
  });
}

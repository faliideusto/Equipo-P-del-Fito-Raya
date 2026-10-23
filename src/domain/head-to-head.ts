import type { Pair } from "./types";
import { MATCH_VALUES } from "./rules";

// Within this many winrate points, a matchup counts as even.
export const EVEN_GAP = 5;
export const POINTS_TO_WIN = 7;
export type Edge = "own" | "rival" | "even" | "unknown";
export type Matchup = { index: number; value: number; own: Pair | null; rival: Pair | null; ownPoints: number | null; rivalPoints: number | null; ownRate: number | null; rivalRate: number | null; edge: Edge };
type Points = (id: string) => number | null | undefined;
type Record = { won: number; decided: number };
type Rates = (id: string) => Record | null | undefined;

// SNP points of a complete pair, or null while a slot is empty or a player has no points.
export function completePairPoints(pair: Pair, points: Points): number | null {
  if (pair.players.some(id => id === null)) return null;
  let sum = 0;
  for (const id of pair.players) { const value = points(id!); if (value == null) return null; sum += value; }
  return Math.round(sum * 100) / 100;
}
// Winrate of a complete pair: both players' matches added up, not the average of two percentages.
export function pairWinRate(pair: Pair, rates: Rates): number | null {
  if (pair.players.some(id => id === null)) return null;
  let won = 0; let decided = 0;
  for (const id of pair.players) { const rate = rates(id!); if (!rate) return null; won += rate.won; decided += rate.decided; }
  return decided ? won / decided * 100 : null;
}
// Pairs play in order of their summed SNP points; incomplete pairs go last.
export function orderedPairs(pairs: Pair[], points: Points): Pair[] {
  const total = (pair: Pair) => pair.players.reduce((sum, id) => sum + (id ? points(id) ?? 0 : 0), 0);
  return [...pairs].sort((a, b) => Number(completePairPoints(b, points) !== null) - Number(completePairPoints(a, points) !== null) || total(b) - total(a) || a.id.localeCompare(b.id));
}
export function edgeOf(ownRate: number | null, rivalRate: number | null): Edge {
  if (ownRate === null || rivalRate === null) return "unknown";
  if (Math.abs(ownRate - rivalRate) <= EVEN_GAP) return "even";
  return ownRate > rivalRate ? "own" : "rival";
}
// Pair N faces the rival's pair N (the order comes from SNP points); the favourite is the pair
// with the clearly higher winrate.
export function headToHead(own: Pair[], ownPoints: Points, ownRates: Rates, rival: Pair[], rivalPoints: Points, rivalRates: Rates): Matchup[] {
  const ours = orderedPairs(own, ownPoints); const theirs = orderedPairs(rival, rivalPoints);
  return MATCH_VALUES.map((value, index) => {
    const a = ours[index] ?? null; const b = theirs[index] ?? null;
    const ra = a && pairWinRate(a, ownRates); const rb = b && pairWinRate(b, rivalRates);
    return { index, value, own: a, rival: b, ownPoints: a && completePairPoints(a, ownPoints), rivalPoints: b && completePairPoints(b, rivalPoints), ownRate: ra, rivalRate: rb, edge: edgeOf(ra, rb) };
  });
}
// Points each side would take if every favourite wins; even and unknown matchups stay open.
export function forecast(matchups: Matchup[]) {
  const sum = (edge: Edge | Edge[]) => matchups.filter(m => ([] as Edge[]).concat(edge).includes(m.edge)).reduce((n, m) => n + m.value, 0);
  const own = sum("own"); const rival = sum("rival"); const open = sum(["even", "unknown"]);
  const verdict = own >= POINTS_TO_WIN ? "own" : rival >= POINTS_TO_WIN ? "rival" : "open";
  return { own, rival, open, verdict } as const;
}

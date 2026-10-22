import type { Pair } from "./types";
import { MATCH_VALUES } from "./rules";

// Below this share of the stronger pair's SNP points, a matchup counts as even.
export const EVEN_SHARE = 0.05;
export const POINTS_TO_WIN = 7;
export type Edge = "own" | "rival" | "even" | "unknown";
export type Matchup = { index: number; value: number; own: Pair | null; rival: Pair | null; ownPoints: number | null; rivalPoints: number | null; edge: Edge };
type Points = (id: string) => number | null | undefined;

// SNP points of a complete pair, or null while a slot is empty or a player has no points.
export function completePairPoints(pair: Pair, points: Points): number | null {
  if (pair.players.some(id => id === null)) return null;
  let sum = 0;
  for (const id of pair.players) { const value = points(id!); if (value == null) return null; sum += value; }
  return Math.round(sum * 100) / 100;
}
// Pairs play in order of their summed SNP points; incomplete pairs go last.
export function orderedPairs(pairs: Pair[], points: Points): Pair[] {
  const total = (pair: Pair) => pair.players.reduce((sum, id) => sum + (id ? points(id) ?? 0 : 0), 0);
  return [...pairs].sort((a, b) => Number(completePairPoints(b, points) !== null) - Number(completePairPoints(a, points) !== null) || total(b) - total(a) || a.id.localeCompare(b.id));
}
export function edgeOf(ownPoints: number | null, rivalPoints: number | null): Edge {
  if (ownPoints === null || rivalPoints === null) return "unknown";
  if (Math.abs(ownPoints - rivalPoints) <= EVEN_SHARE * Math.max(ownPoints, rivalPoints)) return "even";
  return ownPoints > rivalPoints ? "own" : "rival";
}
// Pair N faces the rival's pair N; the favourite is the pair with clearly more SNP points.
export function headToHead(own: Pair[], ownPoints: Points, rival: Pair[], rivalPoints: Points): Matchup[] {
  const ours = orderedPairs(own, ownPoints); const theirs = orderedPairs(rival, rivalPoints);
  return MATCH_VALUES.map((value, index) => {
    const a = ours[index] ?? null; const b = theirs[index] ?? null;
    const pa = a && completePairPoints(a, ownPoints); const pb = b && completePairPoints(b, rivalPoints);
    return { index, value, own: a, rival: b, ownPoints: pa, rivalPoints: pb, edge: edgeOf(pa, pb) };
  });
}
// Points each side would take if every favourite wins; even and unknown matchups stay open.
export function forecast(matchups: Matchup[]) {
  const sum = (edge: Edge | Edge[]) => matchups.filter(m => ([] as Edge[]).concat(edge).includes(m.edge)).reduce((n, m) => n + m.value, 0);
  const own = sum("own"); const rival = sum("rival"); const open = sum(["even", "unknown"]);
  const verdict = own >= POINTS_TO_WIN ? "own" : rival >= POINTS_TO_WIN ? "rival" : "open";
  return { own, rival, open, verdict } as const;
}

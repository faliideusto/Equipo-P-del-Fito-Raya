import { MATCH_VALUES } from "./rules";

// Line-up of a match day on a padel court: the ten best ranked players form the five
// pairs in ranking order (pair 1 = players 1 and 2) and everyone else is a substitute.
export const STARTERS = MATCH_VALUES.length * 2;

export function squadLayout<T>(ranked: T[], benchOrder?: (a: T, b: T) => number) {
  const pairs: { index: number; value: number; players: T[] }[] = [];
  for (let index = 0; index < MATCH_VALUES.length && index * 2 < ranked.length; index++)
    pairs.push({ index, value: MATCH_VALUES[index], players: ranked.slice(index * 2, index * 2 + 2) });
  const bench = ranked.slice(STARTERS);
  if (benchOrder) bench.sort(benchOrder);
  return { pairs, bench };
}

const SIDE_SHORT = { RIGHT: "DER", LEFT: "REV", BOTH: "AMB" } as const;
export const sideShort = (position: keyof typeof SIDE_SHORT | null) => position ? SIDE_SHORT[position] : "—";

// 62421.88 → "62,4K": SNP points are too long for the rating corner of a card.
export function compactPoints(points: number | null) {
  if (points === null) return "—";
  if (points < 1000) return String(Math.round(points));
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(Math.floor(points / 100) / 10)}K`;
}

// Card colour by SNP points: gold from 45k, silver from 30k, bronze below.
export type PointsTier = "gold" | "silver" | "bronze";
export function pointsTier(points: number | null): PointsTier {
  if (points !== null && points >= 45000) return "gold";
  if (points !== null && points >= 30000) return "silver";
  return "bronze";
}

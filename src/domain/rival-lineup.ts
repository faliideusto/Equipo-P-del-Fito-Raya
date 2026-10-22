import type { Pair } from "./types";

// Five pairs of rival players: each player at most once and from the rival's SNP squad.
export function cleanRivalPairs(value: unknown, playerIds: string[]): Pair[] | null {
  if (!Array.isArray(value) || value.length !== 5) return null;
  const used = new Set<string>(); const pairIds = new Set<string>();
  const pairs: Pair[] = [];
  for (const pair of value) {
    if (typeof pair?.id !== "string" || !/^slot-[0-4]$/.test(pair.id) || pairIds.has(pair.id) || !Array.isArray(pair.players) || pair.players.length !== 2) return null;
    pairIds.add(pair.id);
    for (const id of pair.players) {
      if (id === null) continue;
      if (typeof id !== "string" || used.has(id) || !playerIds.includes(id)) return null;
      used.add(id);
    }
    pairs.push({ id: pair.id, players: [pair.players[0], pair.players[1]] });
  }
  return used.size ? pairs : null;
}

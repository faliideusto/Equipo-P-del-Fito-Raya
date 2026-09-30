import type { Match, Pair, Player, Position, TeamId } from "./types";
export const MATCH_VALUES = [3, 3, 2, 2, 2] as const;
export const POSITION_LABELS: Record<Position, string> = {
  RIGHT: "Derecha",
  LEFT: "Revés",
  BOTH: "Ambos",
};
export function matchValue(index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= MATCH_VALUES.length)
    throw new Error("Pareja fuera de rango");
  return MATCH_VALUES[index];
}
export function positionLabel(position: Position | null): string {
  return position === null
    ? "Posición por confirmar"
    : POSITION_LABELS[position];
}
export function pairPoints(pair: Pair, players: Player[]): number | null {
  let sum = 0;
  for (const id of pair.players) {
    if (id === null) continue;
    const player = players.find((p) => p.id === id);
    if (!player || player.points === null) return null;
    sum += player.points;
  }
  return Math.round(sum * 100) / 100;
}
export function sortPairs(pairs: Pair[], players: Player[]): Pair[] {
  return [...pairs].sort(
    (a, b) =>
      (pairPoints(b, players) ?? -1) - (pairPoints(a, players) ?? -1) ||
      a.id.localeCompare(b.id),
  );
}
export function compatible(
  a: Position | null,
  b: Position | null,
): boolean | null {
  if (a === null || b === null) return null;
  return a === "BOTH" || b === "BOTH" || a !== b;
}
export function duplicatePlayers(pairs: Pair[]): string[] {
  const ids = pairs
    .flatMap((p) => p.players)
    .filter((id): id is string => id !== null);
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}
export function matchPoints(match: Match): { home: number; away: number } {
  const value = matchValue(match.pairIndex);
  return {
    home: match.winner === "home" ? value : 0,
    away: match.winner === "away" ? value : 0,
  };
}
export function fixtureScore(matches: Match[]): { home: number; away: number } {
  if (
    matches.length !== 5 ||
    new Set(matches.map((m) => m.pairIndex)).size !== 5
  )
    throw new Error("Una jornada jugada necesita cinco partidos únicos");
  return matches.reduce(
    (score, match) => {
      const result = matchPoints(match);
      return { home: score.home + result.home, away: score.away + result.away };
    },
    { home: 0, away: 0 },
  );
}
export function emptyLineup(): Pair[] {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `slot-${i}`,
    players: [null, null],
  }));
}
export function removePlayer(pairs: Pair[], playerId: string): Pair[] {
  return pairs.map((p) => ({
    ...p,
    players: p.players.map((id) =>
      id === playerId ? null : id,
    ) as Pair["players"],
  }));
}
// Two free players form a new pair without replacing an existing assignment.
export function createPair(
  pairs: Pair[], firstId: string, secondId: string,
  players: Player[], selected: string[], teamId: TeamId,
): Pair[] {
  const target = pairs.find((pair) => pair.players.every((id) => id === null));
  const ids = [firstId, secondId];
  if (!target || firstId === secondId || ids.some((id) =>
    !selected.includes(id) || !players.some((player) => player.id === id && player.teamId === teamId) ||
    pairs.some((pair) => pair.players.includes(id))
  )) return pairs;
  return pairs.map((pair) => pair.id === target.id
    ? { ...pair, players: [firstId, secondId] as Pair["players"] }
    : pair);
}
// Assignment moves an unassigned player or swaps two occupied slots atomically.
export function assignPlayer(
  pairs: Pair[],
  playerId: string,
  targetId: string,
  slot: 0 | 1,
  players: Player[],
  selected: string[],
  teamId: TeamId,
): Pair[] {
  if (
    !players.some((p) => p.id === playerId && p.teamId === teamId) ||
    !selected.includes(playerId) ||
    !pairs.some((p) => p.id === targetId)
  )
    return pairs;
  const next = pairs.map((p) => ({
    ...p,
    players: [...p.players] as Pair["players"],
  }));
  const target = next.find((p) => p.id === targetId)!;
  const source = next.find((p) => p.players.includes(playerId));
  const sourceSlot = source?.players.indexOf(playerId);
  if (source && sourceSlot !== undefined)
    source.players[sourceSlot] = target.players[slot];
  target.players[slot] = playerId;
  return next;
}

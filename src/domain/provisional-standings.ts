import type { SnpMatch } from "./snp";
import { MATCH_VALUES } from "./rules";
// A finished encounter: [home, away] points, sets and games, from the five games of its acta.
export type EncounterResult = { homeId: string; awayId: string; points: [number, number]; sets: [number, number]; games: [number, number] };
// null until every game has a winner: a half result would move the table the wrong way.
export function encounterResult(homeId: string, awayId: string, match: SnpMatch): EncounterResult | null {
  const points: [number, number] = [0, 0], sets: [number, number] = [0, 0], games: [number, number] = [0, 0];
  for (let index = 0; index < MATCH_VALUES.length; index++) {
    const game = match.games.find(g => g.index === index); if (!game) return null;
    const won = [game.sets.filter(s => s[0] > s[1]).length, game.sets.filter(s => s[1] > s[0]).length];
    if (won[0] < 2 && won[1] < 2) return null;
    points[won[0] >= 2 ? 0 : 1] += MATCH_VALUES[index];
    for (const s of game.sets) { sets[s[0] > s[1] ? 0 : 1]++; games[0] += s[0]; games[1] += s[1]; }
  }
  return { homeId, awayId, points, sets, games };
}
type Row = { teamId?: string; played: number; won: number; lost: number; points: number; gameDifference?: number };
// SNP's table: points are the sum of the encounter points; with the same points the winner is the one
// with more sets (then games); the difference counts games. Sorted by points, then wins and games.
export function applyEncounters<T extends Row>(rows: T[], results: EncounterResult[]): T[] {
  const table = rows.map(row => ({ ...row }));
  for (const r of results) {
    const home = table.find(row => row.teamId === r.homeId), away = table.find(row => row.teamId === r.awayId);
    if (!home || !away) continue;
    const homeWins = r.points[0] !== r.points[1] ? r.points[0] > r.points[1] : r.sets[0] !== r.sets[1] ? r.sets[0] > r.sets[1] : r.games[0] >= r.games[1];
    for (const [row, side] of [[home, 0], [away, 1]] as const) {
      const won = side === 0 ? homeWins : !homeWins;
      row.played++; row.points += r.points[side]; if (won) row.won++; else row.lost++;
      row.gameDifference = (row.gameDifference ?? 0) + r.games[side] - r.games[1 - side];
    }
  }
  return table.sort((a, b) => b.points - a.points || b.won - a.won || (b.gameDifference ?? 0) - (a.gameDifference ?? 0));
}

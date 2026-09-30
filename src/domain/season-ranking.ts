import type { Player } from "./types";
import type { SnpMatch } from "./snp";
import { matchValue } from "./rules";

export function seasonRanking(players: Player[], matches: { match: SnpMatch; side: 0 | 1 }[]) {
  const rows = players.map(player => ({ player, played: 0, won: 0, lost: 0, setsWon: 0, setsLost: 0, points: 0 }));
  const seen = new Set<string>();
  let unassigned = 0;
  for (const { match, side } of matches) {
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    for (const game of match.games) {
      const setsWon = game.sets.filter(set => set[side] > set[1 - side]).length;
      const setsLost = game.sets.filter(set => set[side] < set[1 - side]).length;
      if (setsWon < 2 && setsLost < 2) continue;
      if (game.index < 0 || game.index > 4) continue;
      const people = side === 0 ? game.home : game.away;
      const names = side === 0 ? game.homePlayers : game.awayPlayers;
      const assigned = new Set<string>();
      for (let i = 0; i < names.length; i++) {
        const id = people?.[i]?.id;
        const candidates = rows.filter(row => id ? row.player.sourceId === id : row.player.name.trim().toLocaleLowerCase("es") === names[i].trim().toLocaleLowerCase("es"));
        if (candidates.length !== 1) { unassigned++; continue; }
        const row = candidates[0];
        if (assigned.has(row.player.id)) continue;
        assigned.add(row.player.id);
        row.played++; row.setsWon += setsWon; row.setsLost += setsLost;
        if (setsWon >= 2) { row.won++; row.points += matchValue(game.index); }
        else row.lost++;
      }
    }
  }
  rows.sort((a, b) => b.points - a.points || b.won - a.won || (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost) || a.player.name.localeCompare(b.player.name, "es"));
  return { rows, unassigned };
}

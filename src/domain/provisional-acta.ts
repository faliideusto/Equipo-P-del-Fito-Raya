import type { SnpMatch, SnpMatchPlayer } from "./snp";
import type { SetScore } from "./match-result";
import { toActaSets } from "./result-edit";
import { MATCH_VALUES } from "./rules";
// Our side of a game, by SNP player id: from the acta when SNP has the lineup, otherwise from the app.
export type ProvisionalPlayer = { id: string; name: string };
// True once SNP shows who played every game on our side: from then on only SNP data counts.
export const actaHasLineup = (acta: SnpMatch, ownSide: 0 | 1) =>
  acta.games.length >= MATCH_VALUES.length && acta.games.every(game => ((ownSide === 0 ? game.home : game.away) ?? []).some(p => p.id));
// The acta completed with what the app knows while SNP has not published it: SNP sets when there are,
// otherwise the result saved in the app; SNP players when there are, otherwise the app lineup.
// Pair N of the app is game N-1 of the acta.
export function provisionalActa({ acta, ownSide, appResults, lineup }: { acta: SnpMatch; ownSide: 0 | 1; appResults: Record<number, SetScore[]>; lineup: Record<number, ProvisionalPlayer[]> }): SnpMatch {
  const games = MATCH_VALUES.map((_, index) => {
    const game = acta.games.find(g => g.index === index) ?? { index, homePlayers: [], awayPlayers: [], sets: [] };
    const sets = game.sets.length ? game.sets : appResults[index + 1] ? toActaSets(appResults[index + 1], ownSide) : [];
    const snpPeople = (ownSide === 0 ? game.home : game.away) ?? [];
    const people: SnpMatchPlayer[] = snpPeople.some(p => p.id) ? snpPeople : (lineup[index + 1] ?? []).map(p => ({ id: p.id, name: p.name, photoUrl: null }));
    const names = people.map(p => p.name);
    return ownSide === 0 ? { ...game, sets, home: people, homePlayers: names } : { ...game, sets, away: people, awayPlayers: names };
  });
  return { ...acta, games };
}

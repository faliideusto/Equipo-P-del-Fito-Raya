import type { SnpMatch, SnpMatchPlayer } from "./snp";
import type { SetScore } from "./match-result";
export type SavedPairResult = { pairIndex: number; sets: SetScore[]; submittedBy: string };
// The user's own result for a fixture: their convoked pair, the pair they submitted
// or the pair they confirmed. Editable until SNP publishes sets for that pair.
export function myResult({ results, userId, playerId, confirmedPair, acta, ownSnpTeamId, home }: { results: SavedPairResult[]; userId: string; playerId: string; confirmedPair: number | null; acta: SnpMatch | null; ownSnpTeamId: string; home: boolean }): (SavedPairResult & { editable: boolean }) | null {
  const index = acta?.teamIds?.indexOf(ownSnpTeamId) ?? -1;
  const side = index >= 0 ? index : home ? 0 : 1;
  const own = (game: SnpMatch["games"][number]): SnpMatchPlayer[] => (side === 0 ? game.home : game.away) ?? [];
  const convoked = acta?.games.find(g => own(g).some(p => p.id === playerId));
  const pair = convoked ? convoked.index + 1 : results.find(r => r.submittedBy === userId)?.pairIndex ?? confirmedPair;
  const result = results.find(r => r.pairIndex === pair);
  if (!result) return null;
  const published = Boolean(acta?.games.find(g => g.index + 1 === result.pairIndex)?.sets.length);
  return { ...result, editable: !published };
}

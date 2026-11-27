import { actaGames, lineupFromPoints, type LineupFromPoints, type RosterPoints } from "@/domain/snp-lineup-points";
import { snpClient } from "./snp-client";
import { validId } from "./snp-service";

// The rival's lineup as SNP already knows it, from the points in the acta of that one fixture.
// Called only when someone opens the hidden site, and never cached: the lineup can change until the match.
export async function snpRivalLineup(fixtureId: string, rivalId: string, roster: RosterPoints[]): Promise<LineupFromPoints | null> {
  try {
    const html = await snpClient.html(`/enfrentamiento/edit/${validId(fixtureId)}/verG`);
    const games = actaGames(html);
    if (!games.length) return null;
    return lineupFromPoints(games, validId(rivalId), roster);
  } catch { return null; }
}

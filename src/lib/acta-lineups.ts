import { actaGames, lineupFromPoints, type LineupFromPoints } from "@/domain/snp-lineup-points";
import type { SnpMatch } from "@/domain/snp";
import { snpClient } from "./snp-client";
import { parseMatch } from "./snp-parser";
import { getSnpTeam, validId } from "./snp-service";

export type ActaSide = { teamId: string; name: string; players: { id: string; name: string; points: number | null }[]; lineup: LineupFromPoints };
export type ActaLineups = { match: SnpMatch | null; sides: [ActaSide, ActaSide] };

// Both lineups of any acta, rebuilt from the points SNP shows for each aligned player.
// Read straight from SNP every time: a hidden lineup can change until the match is played.
export async function actaLineups(fixtureId: string): Promise<ActaLineups | null> {
  const html = await snpClient.html(`/enfrentamiento/edit/${validId(fixtureId)}/verG`);
  const games = actaGames(html);
  const first = games.find(game => game.homeId && game.awayId);
  if (!first) return null;
  let match: SnpMatch | null = null;
  try { match = parseMatch(html, fixtureId); } catch { /* the lineups do not need it */ }
  const ids = [validId(first.homeId), validId(first.awayId)];
  const teams = await Promise.all(ids.map(id => getSnpTeam(id).then(result => result.data).catch(() => null)));
  const sides = ids.map((teamId, index): ActaSide => {
    const players = (teams[index]?.players ?? []).map(player => ({ id: player.id, name: player.name, points: player.points }));
    return { teamId, name: teams[index]?.name.replaceAll("_", " ") || match?.teams[index] || "Equipo", players, lineup: lineupFromPoints(games, teamId, players) };
  });
  return { match, sides: [sides[0], sides[1]] };
}

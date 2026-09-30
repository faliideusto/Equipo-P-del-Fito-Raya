import type { SnpPlayer } from "@/domain/snp";
import type { Player, Position, TeamId } from "@/domain/types";
import { players as savedPlayers } from "./snp-snapshot";
import { snapshotTeams } from "./snp-explorer-snapshot";

export const sharedPlayerIds = ["249269", "368448", "371555"] as const;
export function clubRoster(teamId: TeamId, own: SnpPlayer[], reserves: SnpPlayer[], positions: Record<string, Position | null>): Player[] {
  const entries = new Map(own.map(player => [player.id, player]));
  const reserveEntries = new Map((snapshotTeams["803902"]?.players ?? []).map(player => [player.id, player]));
  for (const player of reserves) reserveEntries.set(player.id, player);
  if (teamId === "a") for (const player of reserveEntries.values()) {
    if (sharedPlayerIds.some(id => id === player.id) && !entries.has(player.id)) entries.set(player.id, player);
  }
  return [...entries.values()].map(p => {
    const shared = sharedPlayerIds.some(id => id === p.id);
    const origin = shared ? "b" : teamId;
    const previous = savedPlayers.find(old => old.teamId === origin && (old.sourceId || old.id.replace(/^[ab]-/, "")) === p.id);
    const playerId = previous?.id ?? `${origin}-${p.id}`;
    return { id: playerId, sourceId: p.id, sourceTeamId: origin === "a" ? "7778" : "803902", name: p.name, teamId, points: p.points, position: Object.hasOwn(positions, playerId) ? positions[playerId] : previous?.position ?? null, photoUrl: p.photoUrl };
  }).sort((a, b) => b.points - a.points);
}

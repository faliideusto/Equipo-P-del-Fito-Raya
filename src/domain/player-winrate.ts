import type { SnpPlayerStats } from "./snp";

export interface PlayerWinRate {
  won: number;
  lost: number;
  decided: number;
  percentage: number | null;
}

export function playerWinRate(stats: Pick<SnpPlayerStats, "won" | "lost">[]): PlayerWinRate {
  const won = stats.reduce((sum, phase) => sum + phase.won, 0);
  const lost = stats.reduce((sum, phase) => sum + phase.lost, 0);
  const decided = won + lost;
  return { won, lost, decided, percentage: decided ? won / decided * 100 : null };
}

export function playerWinRates(current: SnpPlayerStats[], previous: SnpPlayerStats[]) {
  return { current: playerWinRate(current), total: playerWinRate([...current, ...previous]) };
}

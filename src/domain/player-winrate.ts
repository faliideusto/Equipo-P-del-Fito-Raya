import type { SnpPlayerStats } from "./snp";

export interface PlayerWinRate {
  won: number;
  lost: number;
  decided: number;
  percentage: number | null;
  // Sets of the decided matches; older stored copies do not have them.
  setsWon?: number;
  setsLost?: number;
}

export function playerWinRate(stats: (Pick<SnpPlayerStats, "won" | "lost"> & Partial<Pick<SnpPlayerStats, "setsWon" | "setsLost">>)[]): PlayerWinRate {
  const total = (key: "won" | "lost" | "setsWon" | "setsLost") => stats.reduce((sum, phase) => sum + (phase[key] ?? 0), 0);
  const won = total("won"); const lost = total("lost");
  const decided = won + lost;
  const sets = stats.some(phase => phase.setsWon !== undefined) ? { setsWon: total("setsWon"), setsLost: total("setsLost") } : {};
  return { won, lost, decided, percentage: decided ? won / decided * 100 : null, ...sets };
}

export function playerWinRates(current: SnpPlayerStats[], previous: SnpPlayerStats[]) {
  return { current: playerWinRate(current), total: playerWinRate([...current, ...previous]) };
}

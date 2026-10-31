import type { SnpPlayerProfile, SnpPlayerStats } from "./snp";
import { playerWinRate } from "./player-winrate";

// The private "Ranking cayitos": four friends compared on their SNP numbers. Only the three
// club players below can open it; Tomás plays for Top Bal Pádel Game B, in the Fito A division.
export type CayitoMember = { key: string; name: string; snpId?: string; snpTeam?: string; findName?: string };
export const CAYITOS_ACCESS = ["381423", "397865", "381480"] as const;
export const cayitoMembers: CayitoMember[] = [
  { key: "rafael", name: "Rafael Deusto", snpId: "381423", snpTeam: "7778" },
  { key: "hugo", name: "Hugo Monroux", snpId: "397865", snpTeam: "803902" },
  { key: "dionisio", name: "Dionisio Sánchez Márquez", snpId: "381480", snpTeam: "803902" },
  { key: "tomas", name: "Tomás Jesús Martínez Sánchez", findName: "tomas jesus martinez sanchez" },
];
export function canOpenCayitos(playerId: string | null | undefined) {
  return Boolean(playerId && (CAYITOS_ACCESS as readonly string[]).includes(playerId));
}

export const plainName = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
// Every word of the wanted name has to appear, in any order ("MARTINEZ SANCHEZ TOMAS JESUS").
export function sameName(candidate: string, wanted: string) {
  const words = new Set(plainName(candidate).split(" "));
  return plainName(wanted).split(" ").every(word => words.has(word));
}

export type Result = "W" | "L";
export type CayitoStats = {
  key: string; name: string; snpId: string | null; snpTeam: string | null; photoUrl: string | null;
  points: number | null; nationalRank: string | null; peak: number | null; trend: number | null; history: number[];
  played: number; won: number; lost: number; winRate: number | null;
  setsWon: number; setsLost: number; setRate: number | null;
  season: { played: number; won: number; lost: number; winRate: number | null };
  streak: { type: Result; count: number } | null; bestStreak: number; last: Result[];
  error?: string;
};

// Oldest first: last season's phases, then this season's, each round in order.
export function timeline(previous: SnpPlayerStats[], current: SnpPlayerStats[]) {
  return [...previous, ...current].flatMap(phase => phase.jornadas);
}
export function results(previous: SnpPlayerStats[], current: SnpPlayerStats[]): Result[] {
  // SNP only gives the count per round; a round's wins go before its losses.
  return timeline(previous, current).flatMap(round => [...Array<Result>(round.won).fill("W"), ...Array<Result>(round.lost).fill("L")]);
}
export function streaks(list: Result[]) {
  let best = 0; let run = 0;
  list.forEach((result, index) => { run = result === "W" && list[index - 1] === "W" ? run + 1 : result === "W" ? 1 : 0; best = Math.max(best, run); });
  const lastType = list.at(-1);
  if (!lastType) return { streak: null, best };
  let count = 0; for (let index = list.length - 1; index >= 0 && list[index] === lastType; index--) count++;
  return { streak: { type: lastType, count }, best };
}
const rate = (a: number, b: number) => a + b ? a / (a + b) * 100 : null;

export function cayitoStats(member: CayitoMember, profile: SnpPlayerProfile | null, error?: string): CayitoStats {
  const empty: CayitoStats = { key: member.key, name: member.name, snpId: member.snpId ?? null, snpTeam: member.snpTeam ?? null, photoUrl: null, points: null, nationalRank: null, peak: null, trend: null, history: [], played: 0, won: 0, lost: 0, winRate: null, setsWon: 0, setsLost: 0, setRate: null, season: { played: 0, won: 0, lost: 0, winRate: null }, streak: null, bestStreak: 0, last: [], error };
  if (!profile) return empty;
  const fromStats = playerWinRate([...profile.stats, ...profile.previousStats]);
  // The stored total covers every SNP group; older stored copies have no sets.
  const total = profile.winRates?.total ?? fromStats;
  const setsWon = total.setsWon ?? fromStats.setsWon ?? 0; const setsLost = total.setsLost ?? fromStats.setsLost ?? 0;
  const season = playerWinRate(profile.stats);
  const list = results(profile.previousStats, profile.stats);
  const { streak, best } = streaks(list);
  const history = timeline([], profile.stats).map(round => round.points).filter((value): value is number => value !== null && value > 0);
  const everything = [...timeline(profile.previousStats, profile.stats).map(round => round.points ?? 0), profile.points || 0];
  const peak = Math.max(...everything);
  // Change in the last round played: each round stores the ranking it left.
  const trend = history.length > 1 ? history.at(-1)! - history.at(-2)! : null;
  return {
    ...empty, error: undefined, snpId: profile.id, name: member.name, photoUrl: profile.photoUrl ?? null,
    points: profile.points || null, nationalRank: profile.nationalRank, peak: peak > 0 ? peak : null,
    trend, history,
    played: total.won + total.lost, won: total.won, lost: total.lost, winRate: total.percentage,
    setsWon, setsLost, setRate: rate(setsWon, setsLost),
    season: { played: season.won + season.lost, won: season.won, lost: season.lost, winRate: season.percentage },
    streak, bestStreak: best, last: list.slice(-5),
  };
}

export type CayitoSort = "points" | "winRate" | "sets" | "season" | "streak";
const value = (row: CayitoStats, sort: CayitoSort): number => {
  switch (sort) {
    case "points": return row.points ?? -1;
    case "winRate": return row.winRate ?? -1;
    case "sets": return row.setsWon - row.setsLost;
    case "season": return row.season.winRate ?? -1;
    case "streak": return row.streak ? (row.streak.type === "W" ? row.streak.count : -row.streak.count) : 0;
  }
};
export function sortCayitos(rows: CayitoStats[], sort: CayitoSort) {
  return [...rows].sort((a, b) => value(b, sort) - value(a, sort) || (b.points ?? -1) - (a.points ?? -1));
}
// The leader of each category, only when there is a single one with real data.
export function crowns(rows: CayitoStats[]) {
  const leader = (score: (row: CayitoStats) => number | null) => {
    const valid = rows.map(row => ({ row, score: score(row) })).filter((entry): entry is { row: CayitoStats; score: number } => entry.score !== null);
    const top = Math.max(...valid.map(entry => entry.score));
    const winners = valid.filter(entry => entry.score === top);
    return winners.length === 1 ? winners[0].row.key : null;
  };
  return {
    points: leader(row => row.points),
    winRate: leader(row => row.played >= 3 ? row.winRate : null),
    sets: leader(row => row.played ? row.setsWon - row.setsLost : null),
    streak: leader(row => row.streak?.type === "W" && row.streak.count > 1 ? row.streak.count : null),
  };
}

// Tomás's account (app_metadata.role "cayito") belongs to no Fito team: it only opens the ranking,
// the SNP explorer (where his own team, Top Bal, lives) and the files those pages need.
export const CAYITO_HOME = "/ranking-cayitos";
export function cayitoAllowed(path: string) {
  if (path === CAYITO_HOME || path === "/competicion" || path.startsWith("/competicion/")) return true;
  if (path === "/api/account" || path.startsWith("/api/snp/") && !path.startsWith("/api/snp/connect") && !path.startsWith("/api/snp/sync")) return true;
  // Public files (player photos, logos) and Next's own assets.
  return !path.startsWith("/api/") && /^\/(?:_next\/|[\w/.-]+\.(?:png|jpe?g|webp|svg|ico|woff2?|css|js|json|txt|webmanifest)$)/i.test(path);
}

import type { Fixture, TeamId } from "./types";
import type { SnpMatch, SnpMatchPlayer } from "./snp";
// One hour after the start: a quick match can be over in under an hour.
export const RESULT_DELAY_MS = 3600 * 1000;
// The reminder changes about once a week: avoid a full server check on every navigation.
export const PENDING_REFRESH_MS = 5 * 60 * 1000;
export const dueForCheck = (lastCheck: number | null, now: number) => lastCheck === null || now - lastCheck >= PENDING_REFRESH_MS;
export type PendingResult = { fixtureId: string; teamId: TeamId; round: number; date: string; opponent: string; home: boolean; pairLocked: number | null };
export type ActaReading = { kind: "published" } | { kind: "absent" } | { kind: "convoked"; pair: number } | { kind: "no-lineup" } | { kind: "unknown" };
export type ReportState = { dismissedFixtureIds: Set<string>; results: { fixtureId: string; teamId: TeamId; pairIndex: number; submittedBy: string }[] };
// Dates without time are treated as the end of that day: never prompt during matchday.
export function fixtureStart(date: string): number | null {
  if (!date) return null;
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T23:59:59Z` : date);
  return Number.isNaN(time) ? null : time;
}
export function lastPlayedFixture(fixtures: Fixture[], now: number, delay = RESULT_DELAY_MS): Fixture | null {
  let best: { fixture: Fixture; start: number } | null = null;
  for (const fixture of fixtures) {
    const start = fixtureStart(fixture.date);
    if (start === null || start + delay > now) continue;
    if (!best || start > best.start || (start === best.start && fixture.round > best.fixture.round)) best = { fixture, start };
  }
  return best?.fixture ?? null;
}
export function readActa(match: SnpMatch | null, stale: boolean, ownSnpTeamId: string, home: boolean, playerId: string): ActaReading {
  if (!match) return { kind: "unknown" };
  const index = match.teamIds?.indexOf(ownSnpTeamId) ?? -1;
  const side = index >= 0 ? index : home ? 0 : 1;
  const own = (game: SnpMatch["games"][number]): SnpMatchPlayer[] => (side === 0 ? game.home : game.away) ?? [];
  if (!match.games.some(game => own(game).some(p => p.id))) return stale ? { kind: "unknown" } : { kind: "no-lineup" };
  const game = match.games.find(g => own(g).some(p => p.id === playerId));
  if (!game) return { kind: "absent" };
  return game.sets.length ? { kind: "published" } : { kind: "convoked", pair: game.index + 1 };
}
export function pendingFor({ teamId, fixture, acta, userId, reports }: { teamId: TeamId; fixture: Fixture; acta: ActaReading; userId: string; reports: ReportState }): PendingResult | null {
  if (acta.kind !== "convoked" && acta.kind !== "no-lineup") return null;
  if (reports.dismissedFixtureIds.has(fixture.id)) return null;
  const same = reports.results.filter(r => r.fixtureId === fixture.id && r.teamId === teamId);
  if (acta.kind === "convoked" && same.some(r => r.pairIndex === acta.pair)) return null;
  if (acta.kind === "no-lineup" && same.some(r => r.submittedBy === userId)) return null;
  return { fixtureId: fixture.id, teamId, round: fixture.round, date: fixture.date, opponent: fixture.opponent, home: fixture.home, pairLocked: acta.kind === "convoked" ? acta.pair : null };
}

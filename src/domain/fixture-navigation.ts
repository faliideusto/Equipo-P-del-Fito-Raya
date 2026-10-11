import type { Fixture, TeamId } from "./types";
import { lastPlayedFixture } from "./pending-results";
export function adjacentFixtures(fixtures: Fixture[], id: string): { previous: Fixture | null; next: Fixture | null } {
  const ordered = [...fixtures].sort((a, b) => a.round - b.round);
  const index = ordered.findIndex(f => f.id === id);
  if (index < 0) return { previous: null, next: null };
  return { previous: ordered[index - 1] ?? null, next: ordered[index + 1] ?? null };
}
// "Disputada" means already started: no result delay. Ties keep the first team listed.
export function latestStarted(candidates: { teamId: TeamId; fixtures: Fixture[] }[], now: number): { teamId: TeamId; fixture: Fixture } | null {
  let best: { teamId: TeamId; fixture: Fixture; start: number } | null = null;
  for (const { teamId, fixtures } of candidates) {
    const fixture = lastPlayedFixture(fixtures, now, 0); if (!fixture) continue;
    const start = Date.parse(fixture.date);
    if (!best || start > best.start) best = { teamId, fixture, start };
  }
  return best && { teamId: best.teamId, fixture: best.fixture };
}

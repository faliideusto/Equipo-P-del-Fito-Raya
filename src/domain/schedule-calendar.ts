import type { SnpFixture } from "./snp";

export type FixtureOutcome = "win" | "draw" | "loss" | "pending";
export type CalendarDay = { key: string; day: number; inMonth: boolean };

// SNP sends local Madrid dates ("2026-09-26" or "2026-09-26T10:00"), so the
// calendar day is the date part as written, with no timezone conversion.
export const fixtureDay = (date: string | null | undefined) => /^\d{4}-\d{2}-\d{2}/.test(date ?? "") ? date!.slice(0, 10) : null;
export const monthOf = (day: string) => day.slice(0, 7);

export function shiftMonth(month: string, delta: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Every month from the first to the last dated fixture, so empty months in
// between (Christmas, the break before the play-offs) still show up.
export function calendarMonths(fixtures: SnpFixture[]) {
  const months = fixtures.map(f => fixtureDay(f.date)).filter((d): d is string => !!d).map(monthOf).sort();
  if (!months.length) return [];
  const all = [months[0]];
  while (all[all.length - 1] < months[months.length - 1]) all.push(shiftMonth(all[all.length - 1], 1));
  return all;
}

// Opens on the month of the next fixture still to play; once the season is
// over, on the month of the last one.
export function initialMonth(fixtures: SnpFixture[], today: string) {
  const days = fixtures.map(f => ({ day: fixtureDay(f.date), played: !!f.score })).filter((f): f is { day: string; played: boolean } => !!f.day).sort((a, b) => a.day.localeCompare(b.day));
  if (!days.length) return null;
  const next = days.find(f => !f.played && f.day >= today) ?? days.find(f => f.day >= today);
  return monthOf((next ?? days[days.length - 1]).day);
}

// Monday-first weeks covering the whole month, padded with the days of the
// neighbouring months so every row has seven cells.
export function monthGrid(month: string): CalendarDay[] {
  const [year, value] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, value - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const days: CalendarDay[] = [];
  for (const cursor = new Date(start); days.length < 42; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (days.length % 7 === 0 && days.length && cursor.getUTCMonth() !== value - 1) break;
    days.push({ key: cursor.toISOString().slice(0, 10), day: cursor.getUTCDate(), inMonth: cursor.getUTCMonth() === value - 1 });
  }
  return days;
}

export function fixtureOutcome(fixture: SnpFixture, teamId: string): FixtureOutcome {
  if (!fixture.score) return "pending";
  const home = fixture.homeId === teamId;
  const own = fixture.score[home ? 0 : 1];
  const rival = fixture.score[home ? 1 : 0];
  return own > rival ? "win" : own < rival ? "loss" : "draw";
}

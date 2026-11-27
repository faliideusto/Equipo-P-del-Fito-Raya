import type { SnpFixture } from "./snp";
import { CHALLENGE_ROUND, roundOrder } from "./rounds";

// One encounter of a team's recent form: won, lost or drawn (6–6), with the score from its side.
export type FormResult = "V" | "D" | "E";
export interface FormEntry { fixtureId: string; result: FormResult; own: number; rival: number }
// The team's encounter in the next round still to be played, or a rest when it has none.
export type NextFixture =
  | { kind: "match"; fixtureId: string; round: number; date: string | null; home: boolean; rivalId: string; rivalName: string }
  | { kind: "rest"; round: number; date: string | null };

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Played encounters sorted by when they were played: by date, else by round.
function chronological(a: SnpFixture, b: SnpFixture) {
  const da = a.date ?? "", db = b.date ?? "";
  if (da && db && da !== db) return da < db ? -1 : 1;
  return roundOrder(a.round) - roundOrder(b.round);
}

// Calendars of several divisions repeat shared fixtures (the reto): keep one of each.
export function uniqueFixtures(fixtures: SnpFixture[]): SnpFixture[] {
  const seen = new Set<string>();
  return fixtures.filter(fixture => !seen.has(fixture.id) && Boolean(seen.add(fixture.id)));
}

// The last `limit` encounters the team played, oldest first (the most recent on the right).
export function teamForm(teamId: string, fixtures: SnpFixture[], limit = 5): FormEntry[] {
  return uniqueFixtures(fixtures)
    .filter(f => f.score && (f.homeId === teamId || f.awayId === teamId))
    .sort(chronological)
    .slice(-limit)
    .map(f => {
      const home = f.homeId === teamId;
      const [own, rival] = home ? f.score! : [f.score![1], f.score![0]];
      return { fixtureId: f.id, own, rival, result: own > rival ? "V" : own < rival ? "D" : "E" };
    });
}

// The earliest round of the division calendar with an encounter still to be played.
export function nextRound(calendar: SnpFixture[]): number | null {
  const pending = calendar.filter(f => !f.score).map(f => f.round);
  if (!pending.length) return null;
  return pending.reduce((best, round) => roundOrder(round) < roundOrder(best) ? round : best);
}

// What the team does in the next round: its encounter there, or a rest. null when the calendar is over.
export function nextFixture(teamId: string, calendar: SnpFixture[]): NextFixture | null {
  const round = nextRound(calendar);
  if (round === null) return null;
  const inRound = calendar.filter(f => f.round === round);
  const fixture = inRound.find(f => f.homeId === teamId || f.awayId === teamId);
  if (!fixture) {
    const date = inRound.map(f => f.date).filter((d): d is string => Boolean(d)).sort()[0] ?? null;
    return { kind: "rest", round, date };
  }
  const home = fixture.homeId === teamId;
  return { kind: "match", fixtureId: fixture.id, round, date: fixture.date, home, rivalId: home ? fixture.awayId : fixture.homeId, rivalName: home ? fixture.awayName : fixture.homeName };
}

// "J6 · 28 nov", "Reto · 28 nov" or "J6" when SNP has no date yet.
export function roundLabel(round: number, date: string | null): string {
  const name = round === CHALLENGE_ROUND ? "Reto" : `J${round}`;
  const match = date?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return name;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${name} · ${Number(match[3])} ${month}` : name;
}

// Signed games difference with a real minus sign: "+6", "−18", "0".
export const signed = (value: number) => value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0";

// Short names that read well in a narrow column. SNP names are long and in capitals.
const SHORT_NAMES: Record<string, string> = {
  "CENTRO MÉDICO MONTEALTO - JACARANDA": "Montealto",
  "CRISTALERIA REINA": "Cristalería",
  "PÁDEL GASTRONOMICO MONTEPALMA": "Montepalma",
};
const FILLER = new Set(["PADEL", "PÁDEL", "CLUB", "CD", "C.D.", "CENTRO", "MÉDICO", "MEDICO", "ESCUELA", "GAME", "DE", "DEL", "LA", "EL"]);
const titleCase = (word: string) => word.charAt(0).toLocaleUpperCase("es-ES") + word.slice(1).toLocaleLowerCase("es-ES");

export function shortTeamName(name: string): string {
  const upper = name.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-ES");
  if (SHORT_NAMES[upper]) return SHORT_NAMES[upper];
  const fito = upper.match(/FITO RAYA(?: GAME)? ([A-Z])$/);
  if (fito) return `Fito Raya ${fito[1]}`;
  const words = upper.split(" - ")[0].replace(/_/g, " ").split(" ").filter(Boolean);
  const kept = words.filter(word => !FILLER.has(word));
  return (kept.length ? kept : words).map(titleCase).join(" ");
}

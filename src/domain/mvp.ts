import type { Player } from "./types";
// Month of the club's calendar ("2026-10"), in Madrid time.
export function clubMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}`;
}
export function previousMonth(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, "0")}`;
}
type Award = { month: string; player_id: string; source_id: string };
// The MVP of last month plays this month with the black IF card, in whichever team they appear.
export function inFormIds(awards: Award[], now = new Date()): string[] {
  const month = previousMonth(clubMonth(now));
  return [...new Set(awards.filter(award => award.month === month).flatMap(award => [award.player_id, award.source_id]))];
}
export const isInForm = (player: Pick<Player, "id" | "sourceId">, inForm: string[]) => inForm.includes(player.id) || (!!player.sourceId && inForm.includes(player.sourceId));

import { lastPlayedFixture } from "./pending-results";
import type { Fixture, Pair } from "./types";
import type { NotifyKind } from "./wallet-card";
export type NotifySummary = { total: number; withoutPass: number; apple: { enabled: boolean; ok: number; failed: number }; google: { enabled: boolean; ok: number; failed: number; rateLimited: number } };
export type WalletPlatform = "apple" | "google";
export function walletPlatforms(userAgent: string, available: { apple: boolean; google: boolean }): WalletPlatform[] {
  // One button only: the wallet of the device in hand. A computer without its own wallet configured falls back to the other one.
  const phone = /iPhone|iPad|iPod|Android/.test(userAgent);
  const own: WalletPlatform = /iPhone|iPad|iPod|Macintosh/.test(userAgent) ? "apple" : "google";
  const other: WalletPlatform = own === "apple" ? "google" : "apple";
  return available[own] ? [own] : !phone && available[other] ? [other] : [];
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export function notifySummaryText(s: NotifySummary): string {
  const withPass = s.total - s.withoutPass;
  if (withPass === 0) return "Nadie ha añadido todavía la tarjeta.";
  const parts = [`${withPass} de ${s.total} jugadores tienen la tarjeta.`];
  if (s.apple.enabled) parts.push(`Apple: ${[plural(s.apple.ok, "dispositivo avisado", "dispositivos avisados"), ...(s.apple.failed ? [`${s.apple.failed} con error`] : [])].join(", ")}.`);
  if (s.google.enabled) parts.push(`Google: ${[`${s.google.ok} ${s.google.ok === 1 ? "avisado" : "avisados"}`, ...(s.google.rateLimited ? [`${s.google.rateLimited} sin aviso por el límite de Google`] : []), ...(s.google.failed ? [`${s.google.failed} con error`] : [])].join(", ")}.`);
  return parts.join(" ");
}
// Lineup on the next fixture, result on the last played one; nothing to announce anywhere else.
export function notifyKindFor(fixtures: Fixture[], fixtureId: string, now = Date.now()): NotifyKind | null {
  if (fixtures.find(f => f.status === "pending")?.id === fixtureId) return "lineup";
  return lastPlayedFixture(fixtures, now)?.id === fixtureId ? "result" : null;
}
// Where "Preparar la alineación" leads: whoever can publish goes straight to the builder on the fixture, everyone else to the lab.
export const lineupHref = (teamId: string, fixtureId: string, canPublish: boolean) => canPublish ? `/equipos/${teamId}/jornadas/${fixtureId}#convocatoria` : `/equipos/${teamId}/parejas`;
// Published pairs ready to edit again: players who left the roster become free slots.
export function usablePairs(pairs: Pair[], playerIds: string[]): Pair[] | null {
  if (!Array.isArray(pairs) || pairs.length !== 5) return null;
  return pairs.map(pair => ({ id: pair.id, players: [0, 1].map(slot => { const id = pair.players?.[slot] ?? null; return id !== null && playerIds.includes(id) ? id : null; }) as Pair["players"] }));
}

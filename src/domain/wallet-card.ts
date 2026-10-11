import type { Pair, Position, TeamId } from "./types";
import { POSITION_LABELS } from "./rules";
import { displayName } from "./team-result-message";
export type CardPlayer = { id: string; sourceId: string; name: string; position: Position | null; points: number | null };
export type CardFixture = { id: string; round: number; opponent: string; date: string; home: boolean };
export type CardResult = { fixtureId: string; round: number; opponent: string; ours: number; theirs: number };
export type TeamCardContext = { teamId: TeamId; players: CardPlayer[]; next: CardFixture | null; published: { fixtureId: string; pairs: Pair[] } | null; last: CardResult | null };
// The next fixture split into short pieces: long sentences get cut on the front of a pass.
export type CardNext = { round: string; opponent: string; day: string; time: string | null; venue: string };
export type WalletCardData = { teamId: TeamId; playerSourceId: string; teamLabel: string; playerName: string; playerLine: string; next: CardNext | null; nextMatch: string; lineup: string; lineupShort: string; lastResult: string; snpPoints: string; teamPath: string; actaPath: string | null };
export type NotifyKind = "lineup" | "result";
// "Sáb 18/10" and "10:00" in Madrid time; dates without time have no hour.
function dateParts(date: string): { day: string; time: string | null } | null {
  const time = Date.parse(date); if (!date || Number.isNaN(time)) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Madrid" }).formatToParts(new Date(time)).map(p => [p.type, p.value]));
  const day = `${parts.weekday.charAt(0).toUpperCase()}${parts.weekday.slice(1).replace(".", "")} ${parts.day}/${parts.month}`;
  return { day, time: date.includes("T") ? new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(time)) : null };
}
export function shortDate(date: string): string | null {
  const parts = dateParts(date);
  return parts && (parts.time ? `${parts.day} ${parts.time}` : parts.day);
}
function cardNext(next: CardFixture | null): CardNext | null {
  if (!next) return null;
  const parts = dateParts(next.date);
  return { round: `J${next.round}`, opponent: next.opponent, day: parts?.day ?? "Por confirmar", time: parts?.time ?? null, venue: next.home ? "Local" : "Visitante" };
}
function nextMatch(next: CardFixture | null) {
  return next ? [`J${next.round}`, next.opponent, shortDate(next.date) ?? "Fecha por confirmar", next.home ? "Local" : "Visitante"].join(" · ") : "Sin partidos programados";
}
// The published pairs are frozen in pair order: array position + 1 is the pair number.
// Returns the full sentence (notices, Google) and the short one shown on the front of the Apple pass.
function lineup(ctx: TeamCardContext, player: CardPlayer): [string, string] {
  if (!ctx.next) return ["Sin convocatoria", "Sin convocatoria"];
  const round = `J${ctx.next.round}`;
  if (!ctx.published || ctx.published.fixtureId !== ctx.next.id) return [`Convocatoria ${round} pendiente`, "Pendiente"];
  const index = ctx.published.pairs.findIndex(pair => pair.players.includes(player.id));
  if (index < 0) return [`No convocado en ${round}`, "No convocado"];
  const partnerId = ctx.published.pairs[index].players.find(id => id !== null && id !== player.id);
  const partner = partnerId ? ctx.players.find(p => p.id === partnerId) : undefined;
  const pair = `Pareja ${index + 1}${partner ? ` con ${displayName(partner.name)}` : ""}`;
  return [`Convocado ${round} · ${pair}`, pair];
}
export function buildWalletCard(ctx: TeamCardContext, sourceId: string): WalletCardData | null {
  const player = ctx.players.find(p => p.sourceId === sourceId); if (!player) return null;
  const team = ctx.teamId.toUpperCase(); const name = displayName(player.name);
  const [lineupText, lineupShort] = lineup(ctx, player);
  return {
    teamId: ctx.teamId, playerSourceId: sourceId, teamLabel: `Equipo ${team}`, playerName: name,
    playerLine: player.position ? `${name} · ${POSITION_LABELS[player.position]}` : name,
    next: cardNext(ctx.next), nextMatch: nextMatch(ctx.next), lineup: lineupText, lineupShort,
    lastResult: ctx.last ? `J${ctx.last.round} · Fito Raya ${team} ${ctx.last.ours}–${ctx.last.theirs} ${ctx.last.opponent}` : "Sin resultados todavía",
    snpPoints: player.points === null ? "—" : Math.round(player.points).toLocaleString("es-ES"),
    teamPath: `/equipos/${ctx.teamId}/jornadas`, actaPath: ctx.last ? `/equipos/${ctx.teamId}/jornadas/${ctx.last.fixtureId}` : null,
  };
}
// Google gets the full sentence as the notice; Apple builds its own from the field that changed.
export function walletNotice(ctx: TeamCardContext, card: WalletCardData, kind: NotifyKind): { header: string; body: string } | null {
  if (kind === "lineup") return ctx.next ? { header: `Convocatoria J${ctx.next.round}`, body: card.lineup } : null;
  return ctx.last ? { header: `Resultado J${ctx.last.round}`, body: card.lastResult } : null;
}

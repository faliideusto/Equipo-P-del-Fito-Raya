import type { Pair, Position, TeamId } from "./types";
import { POSITION_LABELS } from "./rules";
import { displayName } from "./team-result-message";
export type CardPlayer = { id: string; sourceId: string; name: string; position: Position | null; points: number | null };
export type CardFixture = { id: string; round: number; opponent: string; date: string; home: boolean };
export type CardResult = { fixtureId: string; round: number; opponent: string; ours: number; theirs: number };
export type TeamCardContext = { teamId: TeamId; players: CardPlayer[]; next: CardFixture | null; published: { fixtureId: string; pairs: Pair[] } | null; last: CardResult | null };
export type WalletCardData = { teamId: TeamId; playerSourceId: string; teamLabel: string; playerLine: string; nextMatch: string; lineup: string; lastResult: string; snpPoints: string; teamPath: string; actaPath: string | null };
export type NotifyKind = "lineup" | "result";
// "Sáb 18/10 10:00" in Madrid time; dates without time show only the day.
export function shortDate(date: string): string | null {
  const time = Date.parse(date); if (!date || Number.isNaN(time)) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Madrid" }).formatToParts(new Date(time)).map(p => [p.type, p.value]));
  const day = `${parts.weekday.charAt(0).toUpperCase()}${parts.weekday.slice(1).replace(".", "")} ${parts.day}/${parts.month}`;
  const hour = date.includes("T") ? new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(time)) : null;
  return hour ? `${day} ${hour}` : day;
}
function nextMatch(next: CardFixture | null) {
  return next ? [`J${next.round}`, next.opponent, shortDate(next.date) ?? "Fecha por confirmar", next.home ? "Local" : "Visitante"].join(" · ") : "Sin partidos programados";
}
// The published pairs are frozen in pair order: array position + 1 is the pair number.
function lineup(ctx: TeamCardContext, player: CardPlayer) {
  if (!ctx.next) return "Sin convocatoria";
  const round = `J${ctx.next.round}`;
  if (!ctx.published || ctx.published.fixtureId !== ctx.next.id) return `Convocatoria ${round} pendiente`;
  const index = ctx.published.pairs.findIndex(pair => pair.players.includes(player.id));
  if (index < 0) return `No convocado en ${round}`;
  const partnerId = ctx.published.pairs[index].players.find(id => id !== null && id !== player.id);
  const partner = partnerId ? ctx.players.find(p => p.id === partnerId) : undefined;
  return `Convocado ${round} · Pareja ${index + 1}${partner ? ` con ${displayName(partner.name)}` : ""}`;
}
export function buildWalletCard(ctx: TeamCardContext, sourceId: string): WalletCardData | null {
  const player = ctx.players.find(p => p.sourceId === sourceId); if (!player) return null;
  const team = ctx.teamId.toUpperCase();
  return {
    teamId: ctx.teamId, playerSourceId: sourceId, teamLabel: `Equipo ${team}`,
    playerLine: player.position ? `${displayName(player.name)} · ${POSITION_LABELS[player.position]}` : displayName(player.name),
    nextMatch: nextMatch(ctx.next), lineup: lineup(ctx, player),
    lastResult: ctx.last ? `J${ctx.last.round} · Fito Raya ${team} ${ctx.last.ours}–${ctx.last.theirs} ${ctx.last.opponent}` : "Sin resultados todavía",
    snpPoints: player.points === null ? "—" : Math.round(player.points).toLocaleString("es-ES"),
    teamPath: `/equipos/${ctx.teamId}/jornadas`, actaPath: ctx.last ? `/equipos/${ctx.teamId}/jornadas/${ctx.last.fixtureId}` : null,
  };
}
// Apple shows the new field value (changeMessage "%@"); Google gets the same text.
export function walletNotice(ctx: TeamCardContext, card: WalletCardData, kind: NotifyKind): { header: string; body: string } | null {
  if (kind === "lineup") return ctx.next ? { header: `Convocatoria J${ctx.next.round}`, body: card.lineup } : null;
  return ctx.last ? { header: `Resultado J${ctx.last.round}`, body: card.lastResult } : null;
}

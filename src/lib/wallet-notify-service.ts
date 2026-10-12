import { clubRepository } from "@/data/repository";
import { sortPairs, validLineupPairs } from "@/domain/rules";
import type { NotifyKind } from "@/domain/wallet-card";
import type { NotifySummary } from "@/domain/wallet-ui";
import type { Pair, TeamId } from "@/domain/types";
import { AccountError, currentAccount } from "./account-auth";
import { lineups } from "./saved-lineups";
import { shareableTeams } from "./team-captains";
import { pushToDevices, withApns } from "./wallet-apns";
import { appleConfig, googleConfig, publicBaseUrl } from "./wallet-config";
import { googleObject, googleWalletClient } from "./wallet-google";
import { loadTeamContext } from "./wallet-issue";
import { notifyTeam, type NotifyChannels } from "./wallet-notify";
import { walletStore } from "./wallet-store";
// Same rule as the WhatsApp message: the coach always, a player only as captain of that team.
export async function requireNotifier(teamId: TeamId) {
  const user = await currentAccount(); if (!user) throw new AccountError("Inicia sesión para acceder a la web.", 401);
  if (!(await shareableTeams(user)).includes(teamId)) throw new AccountError("Solo el entrenador o el capitán pueden avisar al equipo.", 403);
}
export const selectableLineup = (saved: { id: string }[], id: string | null) => saved.some(l => l.id === id) ? id : null;
// True when the signed-in user would see the lineup builder on the next fixture of that team.
export async function canPublishLineup(teamId: TeamId): Promise<boolean> {
  try {
    if (!appleConfig() && !googleConfig()) return false;
    return (await shareableTeams(await currentAccount())).includes(teamId);
  } catch { return false; }
}
// The pairs already published for a fixture, or null when there are none or Wallet storage is unavailable.
export async function publishedPairs(teamId: TeamId, fixtureId: string): Promise<Pair[] | null> {
  try { return (await walletStore().publishedLineup(teamId, fixtureId))?.pairs ?? null; } catch { return null; }
}
export async function notifyOptions(teamId: TeamId) {
  const store = walletStore();
  const [ctx, saved] = await Promise.all([loadTeamContext(teamId, store), lineups(teamId, "list")]);
  const published = ctx.next ? await store.publishedLineup(teamId, ctx.next.id) : null;
  // The published lineup may have been deleted since: only offer it while it is still saved.
  return { nextFixtureId: ctx.next?.id ?? null, lastFixtureId: ctx.last?.fixtureId ?? null, lineups: saved.map(l => ({ id: l.id, name: l.name })), publishedLineupId: selectableLineup(saved, published?.lineup_id ?? null) };
}
// A lineup comes either built on the fixture page (pairs) or as a saved one (lineupId).
export async function publishAndNotify({ teamId, kind, fixtureId, lineupId, pairs: built }: { teamId: TeamId; kind: NotifyKind; fixtureId: string; lineupId?: string; pairs?: unknown }, now = new Date()): Promise<NotifySummary> {
  const apple = appleConfig(); const google = googleConfig(); const baseUrl = publicBaseUrl();
  if (!apple && !google) throw new AccountError("Wallet aún no está configurado.", 503);
  const store = walletStore();
  let ctx = await loadTeamContext(teamId, store, now.getTime());
  if (kind === "lineup") {
    if (ctx.next?.id !== fixtureId) throw new AccountError("Solo se puede publicar la convocatoria del próximo partido.", 409);
    const roster = await clubRepository.getPlayers(teamId);
    let chosen: { id: string | null; pairs: Pair[] };
    if (built !== undefined) {
      if (!validLineupPairs(built, roster.map(p => p.id))) throw new AccountError("La convocatoria está vacía o tiene jugadores que no son de este equipo.");
      chosen = { id: null, pairs: built.map(p => ({ id: p.id, players: p.players })) };
    } else {
      const saved = (await lineups(teamId, "list")).find(l => l.id === lineupId);
      if (!saved) throw new AccountError("No se encuentra esa alineación.", 404);
      chosen = { id: saved.id, pairs: saved.pairs };
    }
    // Frozen in the same order "Preparar parejas" shows, so the pair number never shifts later.
    const pairs = sortPairs(chosen.pairs, roster);
    await store.publishLineup({ team_id: teamId, fixture_id: fixtureId, lineup_id: chosen.id, pairs, published_at: now.toISOString() });
    ctx = { ...ctx, published: { fixtureId, pairs } };
  } else if (ctx.last?.fixtureId !== fixtureId) throw new AccountError("Solo se puede avisar del resultado de la última jornada.", 409);
  const client = google && baseUrl ? googleWalletClient(google) : null;
  const channels: NotifyChannels = {
    google: client && google && baseUrl ? (pass, card, notice) => client.update(pass.google_object_id!, googleObject(card, { issuerId: google.issuerId, serial: pass.serial, baseUrl }), notice, `${kind}-${fixtureId}-${now.getTime()}`) : null,
    apple: apple ? tokens => withApns(apple, send => pushToDevices(tokens, send)) : null,
  };
  return notifyTeam({ store, ctx, kind, channels, now });
}

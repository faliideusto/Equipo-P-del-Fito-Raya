import { buildWalletCard, walletNotice, type NotifyKind, type TeamCardContext, type WalletCardData } from "@/domain/wallet-card";
import type { NotifySummary } from "@/domain/wallet-ui";
import type { PushOutcome } from "./wallet-apns";
import type { GoogleOutcome } from "./wallet-google";
import type { WalletPass, WalletStore } from "./wallet-store";
export type NotifyChannels = {
  apple: ((tokens: string[]) => Promise<Map<string, PushOutcome>>) | null;
  google: ((pass: WalletPass, card: WalletCardData, notice: { header: string; body: string } | null) => Promise<GoogleOutcome>) | null;
};
// One failed pass or device never stops the rest; the summary tells the coach what happened.
export async function notifyTeam({ store, ctx, kind, channels, now }: { store: WalletStore; ctx: TeamCardContext; kind: NotifyKind; channels: NotifyChannels; now: Date }): Promise<NotifySummary> {
  const cards = new Map<string, WalletCardData>();
  for (const player of ctx.players) { const card = buildWalletCard(ctx, player.sourceId); if (card) cards.set(player.sourceId, card); }
  const passes = (await store.teamPasses(ctx.teamId)).filter(p => cards.has(p.player_id));
  const summary: NotifySummary = {
    total: ctx.players.length, withoutPass: ctx.players.filter(pl => !passes.some(p => p.player_id === pl.sourceId)).length,
    apple: { enabled: channels.apple !== null, ok: 0, failed: 0 }, google: { enabled: channels.google !== null, ok: 0, failed: 0, rateLimited: 0 },
  };
  if (channels.google) {
    const send = channels.google;
    const outcomes = await Promise.all(passes.filter(p => p.google_object_id).map(p => { const card = cards.get(p.player_id)!; return send(p, card, walletNotice(ctx, card, kind)); }));
    for (const outcome of outcomes) { if (outcome === "ok") summary.google.ok++; else if (outcome === "rateLimited") summary.google.rateLimited++; else if (outcome === "failed") summary.google.failed++; }
  }
  if (channels.apple && passes.length) {
    const serials = passes.map(p => p.serial);
    await store.touchPasses(serials, now.toISOString());
    const devices = await store.devicesFor(serials);
    const outcomes = devices.length ? await channels.apple(devices.map(d => d.push_token)) : new Map<string, PushOutcome>();
    for (const [token, outcome] of outcomes) {
      if (outcome === "ok") summary.apple.ok++;
      else if (outcome === "failed") summary.apple.failed++;
      else await store.removePushToken(token);
    }
  }
  return summary;
}

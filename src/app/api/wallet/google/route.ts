import { accountFailure, AccountError } from "@/lib/account-auth";
import { walletStore } from "@/lib/wallet-store";
import { ensurePass, googleSaveLink, requireWalletPlayer } from "@/lib/wallet-issue";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { playerId, teamId } = await requireWalletPlayer(new URL(request.url).searchParams.get("team"));
    const store = walletStore();
    const url = await googleSaveLink(await ensurePass(store, playerId, teamId), store);
    if (!url) throw new AccountError("Google Wallet aún no está configurado.", 404);
    return new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "private, no-store" } });
  } catch (error) { return accountFailure(error); }
}

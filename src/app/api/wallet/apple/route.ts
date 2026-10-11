import { accountFailure, AccountError } from "@/lib/account-auth";
import { walletStore } from "@/lib/wallet-store";
import { applePassBuffer, ensurePass, requireWalletPlayer } from "@/lib/wallet-issue";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { playerId, teamId } = await requireWalletPlayer(new URL(request.url).searchParams.get("team"));
    const store = walletStore();
    const buffer = await applePassBuffer(await ensurePass(store, playerId, teamId), store);
    if (!buffer) throw new AccountError("Apple Wallet aún no está configurado.", 404);
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.apple.pkpass", "Content-Disposition": `attachment; filename="fito-raya-${teamId}.pkpass"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return accountFailure(error); }
}

import { accountFailure, accountReply, currentAccount } from "@/lib/account-auth";
import { playerLink } from "@/lib/account-profile";
import { pendingResults } from "@/lib/pending-results-service";
export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await currentAccount();
    if (!user) return accountReply({ error: "Inicia sesión para acceder a la web." }, 401);
    if (user.role === "coach" || user.role === "visitor") return accountReply({ pending: [] });
    const link = await playerLink(user.id);
    return accountReply({ pending: link ? await pendingResults(user.id, link.player_id) : [] });
  } catch (error) { return accountFailure(error); }
}

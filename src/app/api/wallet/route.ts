import { accountFailure, accountReply, currentAccount } from "@/lib/account-auth";
import { playerLink } from "@/lib/account-profile";
import { walletAvailability } from "@/lib/wallet-config";
import { walletTeams } from "@/lib/wallet-issue";
export const runtime = "nodejs";
// What the profile needs to show the Wallet buttons: enabled platforms and the player's teams.
export async function GET() {
  try {
    const user = await currentAccount();
    if (!user) return accountReply({ error: "Inicia sesión para acceder a la web." }, 401);
    const availability = walletAvailability();
    if (user.role !== "player" || (!availability.apple && !availability.google)) return accountReply({ ...availability, teams: [] });
    const link = await playerLink(user.id);
    return accountReply({ ...availability, teams: link ? await walletTeams(link.player_id) : [] });
  } catch (error) { return accountFailure(error); }
}

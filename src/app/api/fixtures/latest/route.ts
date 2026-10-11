import { accountFailure, accountReply, currentAccount } from "@/lib/account-auth";
import { playerLink } from "@/lib/account-profile";
import { latestFixtureFor } from "@/lib/pending-results-service";
export const runtime = "nodejs";
// Lets the menu link straight to the latest matchday instead of hopping through the
// /ultima-jornada redirect, which shows an empty page while the redirect is followed.
export async function GET() {
  try {
    const user = await currentAccount();
    if (!user) return accountReply({ error: "Inicia sesión para acceder a la web." }, 401);
    const link = user.role !== "coach" && user.role !== "visitor" ? await playerLink(user.id).catch(() => null) : null;
    const latest = await latestFixtureFor(link?.player_id ?? null);
    return accountReply({ href: latest ? `/equipos/${latest.teamId}/jornadas/${latest.fixture.id}` : null });
  } catch (error) { return accountFailure(error); }
}

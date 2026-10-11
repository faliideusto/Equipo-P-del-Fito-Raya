import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/account-auth";
import { playerLink } from "@/lib/account-profile";
import { latestFixtureFor } from "@/lib/pending-results-service";
// Shortcut from the menu: open the most recent matchday already started for this user.
export default async function LatestFixturePage() {
  const user = await currentAccount().catch(() => null);
  const link = user && user.role !== "coach" && user.role !== "visitor" ? await playerLink(user.id).catch(() => null) : null;
  const latest = await latestFixtureFor(link?.player_id ?? null);
  redirect(latest ? `/equipos/${latest.teamId}/jornadas/${latest.fixture.id}` : "/equipos/a/jornadas");
}

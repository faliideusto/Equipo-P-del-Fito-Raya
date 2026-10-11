import { accountFailure, accountReply, currentAccount } from "@/lib/account-auth";
import { playerLink } from "@/lib/account-profile";
import { myFixtureResult } from "@/lib/pending-results-service";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await currentAccount();
    if (!user) return accountReply({ error: "Inicia sesión para acceder a la web." }, 401);
    const query = new URL(request.url).searchParams;
    const teamId = query.get("teamId"); const fixtureId = query.get("fixtureId") ?? "";
    if ((teamId !== "a" && teamId !== "b") || !/^\d{1,10}$/.test(fixtureId) || user.role === "coach" || user.role === "visitor") return accountReply({ result: null });
    const link = await playerLink(user.id);
    return accountReply({ result: link ? await myFixtureResult(user.id, link.player_id, teamId, fixtureId) : null });
  } catch (error) { return accountFailure(error); }
}

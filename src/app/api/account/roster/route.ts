import { registrationRoster } from "@/lib/account-roster";
import { accountFailure, accountReply, AccountError } from "@/lib/account-auth";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const teamId = new URL(request.url).searchParams.get("team");
    if (teamId !== "a" && teamId !== "b") throw new AccountError("Selecciona el equipo A o B.");
    // This public endpoint serves only names, sports IDs and availability for
    // registration. It never exposes account IDs, email or SNP user IDs.
    return accountReply({ players: await registrationRoster(teamId) });
  } catch (error) { return accountFailure(error); }
}

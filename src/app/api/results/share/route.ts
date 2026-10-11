import { accountFailure, accountReply, currentAccount } from "@/lib/account-auth";
import { shareableResults } from "@/lib/team-result-service";
export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await currentAccount();
    if (!user) return accountReply({ error: "Inicia sesión para acceder a la web." }, 401);
    return accountReply({ items: await shareableResults(user) });
  } catch (error) { return accountFailure(error); }
}

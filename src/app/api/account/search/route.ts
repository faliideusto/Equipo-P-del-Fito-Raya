import { accountBody, accountFailure, accountReply, limitAccountAttempts } from "@/lib/account-auth";
import { fullPlayerName, nameKey } from "@/lib/club-members";
import { searchRegistrationNames } from "@/lib/registration-search";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await accountBody(request);
    const name = fullPlayerName(body.name);
    limitAccountAttempts(`search:${nameKey(name)}`);
    return accountReply(await searchRegistrationNames(name));
  } catch (error) { return accountFailure(error); }
}

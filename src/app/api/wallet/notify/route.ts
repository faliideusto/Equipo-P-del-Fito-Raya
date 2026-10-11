import { accountBody, accountFailure, accountReply, AccountError } from "@/lib/account-auth";
import { notifyOptions, publishAndNotify, requireNotifier } from "@/lib/wallet-notify-service";
import type { TeamId } from "@/domain/types";
export const runtime = "nodejs";
const isTeam = (value: unknown): value is TeamId => value === "a" || value === "b";
export async function GET(request: Request) {
  try {
    const teamId = new URL(request.url).searchParams.get("teamId");
    if (!isTeam(teamId)) throw new AccountError("Equipo no válido.");
    await requireNotifier(teamId);
    return accountReply(await notifyOptions(teamId));
  } catch (error) { return accountFailure(error); }
}
export async function POST(request: Request) {
  try {
    const body = await accountBody(request);
    const { teamId, kind, fixtureId, lineupId, pairs } = body;
    if (!isTeam(teamId) || (kind !== "lineup" && kind !== "result") || typeof fixtureId !== "string" || !/^\d{1,10}$/.test(fixtureId)) throw new AccountError("Petición no válida.");
    // Pairs built on the fixture page, or the id of a saved lineup.
    const built = Array.isArray(pairs) && pairs.length === 5;
    if (kind === "lineup" && !built && (typeof lineupId !== "string" || !/^[a-f0-9-]{36}$/.test(lineupId))) throw new AccountError("Forma al menos una pareja antes de avisar.");
    await requireNotifier(teamId);
    return accountReply({ summary: await publishAndNotify({ teamId, kind, fixtureId, ...(kind === "lineup" ? (built ? { pairs } : { lineupId: lineupId as string }) : {}) }) });
  } catch (error) { return accountFailure(error); }
}

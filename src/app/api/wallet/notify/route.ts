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
    const { teamId, kind, fixtureId, lineupId } = body;
    if (!isTeam(teamId) || (kind !== "lineup" && kind !== "result") || typeof fixtureId !== "string" || !/^\d{1,10}$/.test(fixtureId)) throw new AccountError("Petición no válida.");
    if (kind === "lineup" && (typeof lineupId !== "string" || !/^[a-f0-9-]{36}$/.test(lineupId))) throw new AccountError("Elige una alineación guardada.");
    await requireNotifier(teamId);
    return accountReply({ summary: await publishAndNotify({ teamId, kind, fixtureId, ...(kind === "lineup" ? { lineupId: lineupId as string } : {}) }) });
  } catch (error) { return accountFailure(error); }
}

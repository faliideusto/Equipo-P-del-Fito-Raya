import { accountBody, accountFailure, accountReply, AccountError } from "@/lib/account-auth";
import { clubRepository } from "@/data/repository";
import { saveAvailability } from "@/lib/fixture-availability";
import { requireNotifier } from "@/lib/wallet-notify-service";
export const runtime = "nodejs";
// The coach and the captains of that team keep one shared list of who signed up for a fixture.
export async function POST(request: Request) {
  try {
    const { teamId, fixtureId, playerIds } = await accountBody(request);
    if ((teamId !== "a" && teamId !== "b") || typeof fixtureId !== "string" || !/^\d{1,10}$/.test(fixtureId) || !Array.isArray(playerIds) || playerIds.length > 60 || playerIds.some(id => typeof id !== "string")) throw new AccountError("Petición no válida.");
    await requireNotifier(teamId);
    const [players, fixtures] = await Promise.all([clubRepository.getPlayers(teamId), clubRepository.getFixtures(teamId)]);
    if (!fixtures.some(f => f.id === fixtureId)) throw new AccountError("Esa jornada no es de este equipo.", 404);
    const roster = new Set(players.map(p => p.id));
    const ids = [...new Set(playerIds as string[])].filter(id => roster.has(id));
    await saveAvailability(teamId, fixtureId, ids);
    return accountReply({ playerIds: ids });
  } catch (error) { return accountFailure(error); }
}

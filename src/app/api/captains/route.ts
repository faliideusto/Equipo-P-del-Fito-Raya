import { accountBody, accountFailure, accountReply, AccountError } from "@/lib/account-auth";
import { isCoachSession } from "@/lib/coach-session";
import { registeredPositions } from "@/lib/account-profile";
import { clubRepository } from "@/data/repository";
import { addCaptain, listCaptains, MAX_CAPTAINS, MissingCaptainsTable, removeCaptain } from "@/lib/team-captains";
import type { TeamId } from "@/domain/types";
export const runtime = "nodejs";
const TEAMS: TeamId[] = ["a", "b"];
// Candidates: roster players with a linked account, so the captain can log in.
async function candidates() {
  const registered = await registeredPositions();
  return Promise.all(TEAMS.map(async teamId => ({ teamId, candidates: (await clubRepository.getPlayers(teamId)).filter(p => p.sourceId && p.sourceId in registered).map(p => ({ id: p.sourceId!, name: p.name })).sort((a, b) => a.name.localeCompare(b.name, "es")) })));
}
async function state() {
  const teams = await candidates();
  try { return { ready: true, captains: await listCaptains(), teams }; }
  catch (error) { if (error instanceof MissingCaptainsTable) return { ready: false, captains: [], teams }; throw error; }
}
export async function GET() {
  try { if (!await isCoachSession()) throw new AccountError("Inicia sesión como entrenador.", 401); return accountReply(await state()); }
  catch (error) { return accountFailure(error); }
}
export async function POST(request: Request) {
  try {
    const body = await accountBody(request);
    if (!await isCoachSession()) throw new AccountError("Inicia sesión como entrenador.", 401);
    const { teamId, playerId, action } = body;
    if ((teamId !== "a" && teamId !== "b") || typeof playerId !== "string" || !/^\d{1,10}$/.test(playerId) || (action !== "add" && action !== "remove")) throw new AccountError("Petición no válida.");
    if (action === "add") {
      if (!(await candidates()).find(t => t.teamId === teamId)?.candidates.some(c => c.id === playerId)) throw new AccountError("Ese jugador no tiene cuenta en este equipo.");
      const current = (await listCaptains().catch(() => [])).filter(c => c.team_id === teamId);
      if (!current.some(c => c.player_id === playerId) && current.length >= MAX_CAPTAINS) throw new AccountError(`Como mucho ${MAX_CAPTAINS} capitanes por equipo. Quita uno antes de añadir otro.`);
    }
    try { if (action === "add") await addCaptain(teamId, playerId); else await removeCaptain(teamId, playerId); }
    catch (error) { if (error instanceof MissingCaptainsTable) throw new AccountError(error.message, 503); throw error; }
    return accountReply(await state());
  } catch (error) { return accountFailure(error); }
}

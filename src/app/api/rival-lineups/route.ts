import { AccountError, accountFailure, accountReply } from "@/lib/account-auth";
import { canPrepareRivals, nextRival } from "@/lib/rival-preparation";
import { clearRivalLineup, MissingRivalLineupsTable, saveRivalLineup } from "@/lib/rival-lineups";
import { getSnpTeam } from "@/lib/snp-service";
import { cleanRivalPairs } from "@/domain/rival-lineup";
import type { TeamId } from "@/domain/types";
export const runtime = "nodejs";
// The coach and the club captains save the lineup they expect from the next rival.
// The fixture and the rival come from SNP on the server, never from the request.
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) return accountReply({ error: "Origen no válido." }, 403);
    const raw = await request.text();
    if (raw.length > 16000) return accountReply({ error: "Petición demasiado grande." }, 413);
    const body = JSON.parse(raw);
    if (!["a", "b"].includes(body?.teamId) || !["save", "clear"].includes(body?.action)) return accountReply({ error: "Datos no válidos." }, 400);
    if (!(await canPrepareRivals())) throw new AccountError("Solo el entrenador y los capitanes pueden preparar al rival.", 403);
    const teamId = body.teamId as TeamId;
    const next = await nextRival(teamId).catch(() => null);
    if (!next) return accountReply({ error: "No hay un próximo rival publicado en SNP." }, 409);
    if (body.action === "clear") { await clearRivalLineup(teamId, next.fixtureId); return accountReply({ ok: true, lineup: null }); }
    const team = (await getSnpTeam(next.rivalId)).data;
    const pairs = cleanRivalPairs(body.pairs, team?.players.map(player => player.id) ?? []);
    if (!pairs) return accountReply({ error: "La alineación contiene jugadores no válidos o está vacía." }, 400);
    const lineup = await saveRivalLineup({ team_id: teamId, fixture_id: next.fixtureId, rival_id: next.rivalId, pairs });
    return accountReply({ ok: true, lineup });
  } catch (error) {
    if (error instanceof SyntaxError) return accountReply({ error: "Datos no válidos." }, 400);
    if (error instanceof MissingRivalLineupsTable || (error instanceof Error && error.message.startsWith("Configura Supabase"))) return accountReply({ error: error.message }, 503);
    return accountFailure(error instanceof AccountError ? error : new AccountError("No se pudo guardar la alineación del rival. Inténtalo de nuevo.", 500));
  }
}

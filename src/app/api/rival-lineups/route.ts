import { AccountError, accountFailure, accountReply } from "@/lib/account-auth";
import { canPrepareRivals, nextRival } from "@/lib/rival-preparation";
import { clearRivalLineup, MissingRivalLineupsTable, readRivalLineup, saveRivalLineup } from "@/lib/rival-lineups";
import { getSnpTeam } from "@/lib/snp-service";
import { clubRepository } from "@/data/repository";
import { cleanLineupPairs } from "@/domain/rival-lineup";
import { emptyLineup } from "@/domain/rules";
import type { Pair, TeamId } from "@/domain/types";
export const runtime = "nodejs";
const ACTIONS = ["save", "clear", "save-own", "clear-own"];
const filled = (pairs: Pair[] | null | undefined) => Boolean(pairs?.some(pair => pair.players.some(Boolean)));
// The coach and the club captains save the lineup they expect from the next rival, and ours against it.
// The fixture and the rival come from SNP on the server, never from the request.
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) return accountReply({ error: "Origen no válido." }, 403);
    const raw = await request.text();
    if (raw.length > 16000) return accountReply({ error: "Petición demasiado grande." }, 413);
    const body = JSON.parse(raw);
    if (!["a", "b"].includes(body?.teamId) || !ACTIONS.includes(body?.action)) return accountReply({ error: "Datos no válidos." }, 400);
    if (!(await canPrepareRivals())) throw new AccountError("Solo el entrenador y los capitanes pueden preparar al rival.", 403);
    const teamId = body.teamId as TeamId;
    const next = await nextRival(teamId).catch(() => null);
    if (!next) return accountReply({ error: "No hay un próximo rival publicado en SNP." }, 409);
    const existing = await readRivalLineup(teamId, next.fixtureId);
    let pairs = existing?.pairs ?? emptyLineup(); let ownPairs = existing?.own_pairs ?? null;
    if (body.action === "save") {
      const team = (await getSnpTeam(next.rivalId)).data;
      const clean = cleanLineupPairs(body.pairs, team?.players.map(player => player.id) ?? []);
      if (!clean) return accountReply({ error: "La alineación contiene jugadores no válidos o está vacía." }, 400);
      pairs = clean;
    } else if (body.action === "save-own") {
      const players = await clubRepository.getPlayers(teamId);
      const clean = cleanLineupPairs(body.ownPairs, players.map(player => player.id));
      if (!clean) return accountReply({ error: "Nuestra alineación contiene jugadores no válidos o está vacía." }, 400);
      ownPairs = clean;
    } else if (body.action === "clear") pairs = emptyLineup();
    else ownPairs = null;
    if (!filled(pairs) && !filled(ownPairs)) { await clearRivalLineup(teamId, next.fixtureId); return accountReply({ ok: true, lineup: null }); }
    const lineup = await saveRivalLineup({ team_id: teamId, fixture_id: next.fixtureId, rival_id: next.rivalId, pairs, own_pairs: ownPairs });
    return accountReply({ ok: true, lineup });
  } catch (error) {
    if (error instanceof SyntaxError) return accountReply({ error: "Datos no válidos." }, 400);
    if (error instanceof MissingRivalLineupsTable || (error instanceof Error && error.message.startsWith("Configura Supabase"))) return accountReply({ error: error.message }, 503);
    return accountFailure(error instanceof AccountError ? error : new AccountError("No se pudo guardar la alineación. Inténtalo de nuevo.", 500));
  }
}

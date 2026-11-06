import { AccountError, accountFailure, accountReply, currentAccount } from "@/lib/account-auth";
import { nextGuestRival, topBalTeam } from "@/lib/cayitos";
import { clearRivalLineup, MissingRivalLineupsTable, readRivalLineup, saveRivalLineup } from "@/lib/rival-lineups";
import { getSnpTeam } from "@/lib/snp-service";
import { cleanLineupPairs } from "@/domain/rival-lineup";
import { emptyLineup } from "@/domain/rules";
import type { Pair } from "@/domain/types";
export const runtime = "nodejs";
const ACTIONS = ["save", "clear", "save-own", "clear-own"];
const filled = (pairs: Pair[] | null | undefined) => Boolean(pairs?.some(pair => pair.players.some(Boolean)));
// Tomás's own hidden site: only his account (role "cayito") saves the lineup he expects from
// Top Bal's next rival, and his team's against it. His team, the fixture and the rival come from SNP.
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) return accountReply({ error: "Origen no válido." }, 403);
    const raw = await request.text();
    if (raw.length > 16000) return accountReply({ error: "Petición demasiado grande." }, 413);
    const body = JSON.parse(raw);
    if (!ACTIONS.includes(body?.action)) return accountReply({ error: "Datos no válidos." }, 400);
    if ((await currentAccount())?.role !== "cayito") throw new AccountError("Este sitio oculto es solo para Tomás.", 403);
    const ownTeam = await topBalTeam();
    const next = await nextGuestRival(ownTeam).catch(() => null);
    if (!next) return accountReply({ error: "No hay un próximo rival publicado en SNP." }, 409);
    const existing = await readRivalLineup("tomas", next.fixtureId);
    let pairs = existing?.pairs ?? emptyLineup(); let ownPairs = existing?.own_pairs ?? null;
    if (body.action === "save" || body.action === "save-own") {
      const team = (await getSnpTeam(body.action === "save" ? next.rivalId : ownTeam)).data;
      const clean = cleanLineupPairs(body.action === "save" ? body.pairs : body.ownPairs, team?.players.map(player => player.id) ?? []);
      if (!clean) return accountReply({ error: "La alineación contiene jugadores no válidos o está vacía." }, 400);
      if (body.action === "save") pairs = clean; else ownPairs = clean;
    } else if (body.action === "clear") pairs = emptyLineup();
    else ownPairs = null;
    if (!filled(pairs) && !filled(ownPairs)) { await clearRivalLineup("tomas", next.fixtureId); return accountReply({ ok: true, lineup: null }); }
    const lineup = await saveRivalLineup({ team_id: "tomas", fixture_id: next.fixtureId, rival_id: next.rivalId, pairs, own_pairs: ownPairs });
    return accountReply({ ok: true, lineup });
  } catch (error) {
    if (error instanceof SyntaxError) return accountReply({ error: "Datos no válidos." }, 400);
    if (error instanceof MissingRivalLineupsTable || (error instanceof Error && error.message.startsWith("Configura Supabase"))) return accountReply({ error: error.message }, 503);
    return accountFailure(error instanceof AccountError ? error : new AccountError("No se pudo guardar la alineación. Inténtalo de nuevo.", 500));
  }
}

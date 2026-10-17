import { clubRepository } from "@/data/repository";
import { cleanNickname } from "@/domain/team-result-message";
import { AccountError, accountFailure, accountReply, currentAccount } from "@/lib/account-auth";
import { hasPersistentPlayerData } from "@/lib/player-attribute-store";
import { saveNicknames } from "@/lib/player-nicknames";
import { shareableTeams } from "@/lib/team-captains";
export const runtime = "nodejs";
// The coach and the captains of the team edit its nicknames; they are stored by SNP player id.
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) return accountReply({ error: "Origen no válido." }, 403);
    const raw = await request.text();
    if (raw.length > 16000) return accountReply({ error: "Petición demasiado grande." }, 413);
    const body = JSON.parse(raw);
    if (!["a", "b"].includes(body?.teamId) || !Array.isArray(body.nicknames) || body.nicknames.length > 40) return accountReply({ error: "Datos no válidos." }, 400);
    const user = await currentAccount(); if (!user) throw new AccountError("Inicia sesión para acceder a la web.", 401);
    if (!(await shareableTeams(user)).includes(body.teamId)) throw new AccountError("Solo el entrenador o los capitanes pueden cambiar los motes.", 403);
    if (!hasPersistentPlayerData()) return accountReply({ error: "Configura Supabase para conservar los motes." }, 503);
    const players = await clubRepository.getPlayers(body.teamId);
    const updates: Record<string, string | null> = {};
    for (const row of body.nicknames) {
      const player = players.find(player => player.id === row?.id);
      const key = player && (player.sourceId ?? player.id);
      if (!key || Object.hasOwn(updates, key)) return accountReply({ error: "Jugador no válido." }, 400);
      const nickname = cleanNickname(row.nickname);
      if (nickname === undefined) return accountReply({ error: "Mote no válido: hasta 20 caracteres, sin paréntesis." }, 400);
      updates[key] = nickname;
    }
    await saveNicknames(updates);
    return accountReply({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) return accountReply({ error: "Datos no válidos." }, 400);
    return accountFailure(error instanceof AccountError ? error : new AccountError("No se pudieron guardar los motes. Inténtalo de nuevo.", 500));
  }
}

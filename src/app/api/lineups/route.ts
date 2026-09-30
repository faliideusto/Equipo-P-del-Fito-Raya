import { randomUUID } from "node:crypto";
import { verifyCoachPassword, changeCoachPassword } from "@/lib/coach-auth";
import { clubRepository } from "@/data/repository";
import { lineups } from "@/lib/saved-lineups";
import type { Pair } from "@/domain/types";
export const runtime = "nodejs";
let failed = 0; let reset = 0;
export async function POST(request: Request) {
  const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) return reply({ error: "Origen no válido." }, 403);
    const raw = await request.text(); if (raw.length > 16000) return reply({ error: "Petición demasiado grande." }, 413);
    const body = JSON.parse(raw);
    if (Date.now() > reset) { failed = 0; reset = Date.now() + 300000; }
    if (failed >= 10) return reply({ error: "Espera cinco minutos antes de volver a intentar." }, 429);
    if (!await verifyCoachPassword(body.password)) { failed++; return reply({ error: "Contraseña incorrecta." }, 401); }
    if (body.action === "change-password") {
      if (typeof body.newPassword !== "string" || body.newPassword.length < 12 || body.newPassword.length > 128 || body.newPassword === body.password) return reply({ error: "Usa una contraseña nueva de entre 12 y 128 caracteres." }, 400);
      await changeCoachPassword(body.newPassword);
      return reply({ ok: true });
    }
    if (!['a', 'b'].includes(body.teamId) || !['list', 'save', 'delete'].includes(body.action)) return reply({ error: "Datos no válidos." }, 400);
    let value;
    if (body.action === "save") {
      if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 80 || !Array.isArray(body.pairs) || body.pairs.length !== 5) return reply({ error: "Añade un nombre de hasta 80 caracteres." }, 400);
      const players = await clubRepository.getPlayers(body.teamId); const used = new Set<string>(); const pairIds = new Set<string>();
      const valid = body.pairs.every((p: Pair) => {
        if (typeof p?.id !== "string" || p.id.length > 40 || pairIds.has(p.id) || !Array.isArray(p.players) || p.players.length !== 2) return false;
        pairIds.add(p.id);
        return p.players.every(id => { if (id === null) return true; if (used.has(id) || !players.some(player => player.id === id)) return false; used.add(id); return true; });
      });
      if (!valid || !used.size) return reply({ error: "La alineación contiene jugadores no válidos o está vacía." }, 400);
      value = { id: randomUUID(), team_id: body.teamId, name: body.name.trim(), pairs: body.pairs.map((p: Pair) => ({ id: p.id, players: p.players })), created_at: new Date().toISOString() };
    }
    if (body.action === "delete" && (typeof body.id !== "string" || !/^[a-f0-9-]{36}$/.test(body.id))) return reply({ error: "Identificador no válido." }, 400);
    return reply({ ok: true, lineups: await lineups(body.teamId, body.action, value, body.id) });
  } catch (e) { return reply({ error: e instanceof Error && (e.message.startsWith("No se pudo acceder") || e.message.startsWith("Configura Supabase")) ? e.message : "No se pudo completar la operación." }, 500); }
}

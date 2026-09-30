import { verifyCoachPassword } from "@/lib/coach-auth";
import { clubRepository } from "@/data/repository";
import { savePositions, hasPersistentPositions } from "@/lib/player-positions";
import type { Position } from "@/domain/types";
export const runtime = "nodejs";
let failed = 0;
let resetAt = 0;
export async function POST(request: Request) {
  const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) return reply({ error: "Origen no válido." }, 403);
    const raw = await request.text();
    if (raw.length > 16000) return reply({ error: "Petición demasiado grande." }, 413);
    const body = JSON.parse(raw);
    if (Date.now() > resetAt) { failed = 0; resetAt = Date.now() + 300000; }
    if (failed >= 10) return reply({ error: "Demasiados intentos. Espera cinco minutos." }, 429);
    if (!await verifyCoachPassword(body.password)) { failed++; return reply({ error: "Contraseña incorrecta." }, 401); }
    if (!hasPersistentPositions()) return reply({ error: "Configura Supabase para que las posiciones se conserven en Render gratuito." }, 503);
    if (body.action === "unlock") return reply({ ok: true });
    if (body.action !== "save" || !["a", "b"].includes(body.teamId) || !Array.isArray(body.positions) || body.positions.length > 40) return reply({ error: "Datos no válidos." }, 400);
    const players = await clubRepository.getPlayers(body.teamId);
    const updates: Record<string, Position | null> = {};
    for (const row of body.positions) {
      const player = players.find(player => player.id === row?.id);
      if (!player || ![null, "LEFT", "RIGHT", "BOTH"].includes(row.position) || Object.hasOwn(updates, player.id)) return reply({ error: "Jugador o posición no válidos." }, 400);
      updates[player.id] = row.position;
    }
    await savePositions(updates);
    return reply({ ok: true });
  } catch { return reply({ error: "No se pudieron guardar las posiciones. Inténtalo de nuevo." }, 500); }
}

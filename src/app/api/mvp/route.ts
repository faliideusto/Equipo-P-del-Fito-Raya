import { verifyCoachPassword } from "@/lib/coach-auth";
import { mvpAwards } from "@/lib/mvp";
import { clubRepository } from "@/data/repository";
export const runtime = "nodejs";
let failed = 0; let reset = 0;
export async function POST(request: Request) {
  const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) return reply({ error: "Origen no válido." }, 403);
    const raw = await request.text(); if (raw.length > 4000) return reply({ error: "Petición demasiado grande." }, 413);
    const body = JSON.parse(raw);
    if (Date.now() > reset) { failed = 0; reset = Date.now() + 300000; }
    if (failed >= 10) return reply({ error: "Demasiados intentos. Espera cinco minutos." }, 429);
    if (!await verifyCoachPassword(body.password)) { failed++; return reply({ error: "Contraseña incorrecta." }, 401); }
    if (body.action === "unlock") return reply({ ok: true });
    if (!["save", "clear"].includes(body.action) || !["a", "b"].includes(body.teamId) || typeof body.month !== "string" || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(body.month) || (body.action === "save" && typeof body.playerId !== "string")) return reply({ error: "Selecciona equipo, mes y jugador." }, 400);
    if (body.action === "clear" || body.playerId === "") return reply({ ok: true, awards: await mvpAwards(undefined, { team_id: body.teamId, month: body.month }) });
    const player = (await clubRepository.getPlayers(body.teamId)).find(p => p.id === body.playerId);
    if (!player) return reply({ error: "El jugador no pertenece a la plantilla disponible de este equipo." }, 400);
    const awards = await mvpAwards({ team_id: body.teamId, month: body.month, player_id: player.id, source_id: player.sourceId ?? player.id, name: player.name, photo_url: player.photoUrl ?? null, updated_at: new Date().toISOString() });
    return reply({ ok: true, awards });
  } catch { return reply({ error: "No se pudo guardar el MVP. Comprueba la conexión y ejecuta supabase/mvp.sql si falta la tabla." }, 500); }
}

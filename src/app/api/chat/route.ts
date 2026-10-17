import { AccountError, accountFailure, currentAccount, requireSameOrigin } from "@/lib/account-auth";
import { chatIdentity } from "@/lib/chat/identity";
import { createLlmClient } from "@/lib/chat/llm-client";
import { runConversation } from "@/lib/chat/conversation";
import { clubChatData } from "@/lib/chat/data";
import { allowChat } from "@/lib/chat/rate-limit";
export const runtime = "nodejs";
const MAX_BODY = 24000;

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const raw = await request.text();
    if (raw.length > MAX_BODY) throw new AccountError("La conversación es demasiado larga. Empieza una nueva.", 413);
    let body: { messages?: unknown; equipo?: unknown };
    try { body = JSON.parse(raw); } catch { throw new AccountError("Petición no válida."); }
    const team = body.equipo === "a" || body.equipo === "b" ? body.equipo : null;
    if (body.equipo !== undefined && body.equipo !== null && !team) throw new AccountError("Equipo no válido.");
    const user = await currentAccount();
    if (!user) throw new AccountError("Inicia sesión para usar el asistente.", 401);
    const role = user.role;
    if (role !== "player" && role !== "coach") throw new AccountError("El asistente es solo para los jugadores y el entrenador del club.", 403);
    if (!allowChat(user.id)) throw new AccountError("Has hecho muchas preguntas seguidas. Espera un rato.", 429);
    const { label } = await chatIdentity(user);
    const events = runConversation({ history: body.messages, role, userLabel: label, now: new Date(), llm: createLlmClient(), data: clubChatData, team });
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await events.next();
        if (done) controller.close(); else controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
      },
      async cancel() { await events.return(undefined); },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch (error) { return accountFailure(error); }
}

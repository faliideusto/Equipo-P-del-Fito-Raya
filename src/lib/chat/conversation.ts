import { ChatUnavailableError } from "./llm-client";
import { runTool, toolsFor, type ChatData } from "./tools";
import type { ChatEvent, ChatRole, HistoryMessage, LlmClient, LlmMessage, LlmToolCall } from "./types";

export const MAX_ROUNDS = 4;
const MAX_HISTORY = 10;
const MAX_CHARS = 2000;

// Only user and assistant turns travel from the browser; system and tool turns are always built here.
export function trimHistory(history: unknown): HistoryMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m): m is HistoryMessage => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0)
    .slice(-MAX_HISTORY)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
}

export function systemPrompt(role: ChatRole, userLabel: string, now: Date) {
  const today = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "full", timeStyle: "short" }).format(now);
  const lines = [
    "Eres el asistente de la Escuela Fito Raya, un club de pádel con dos equipos en las Series Nacionales de Pádel (SNP): el equipo A juega en 2ª División Future y el equipo B en 10ª División Future.",
    `Ahora es ${today} (hora de Madrid). Hablas con ${userLabel}.`,
    "Reglas:",
    "- Responde siempre en español, breve y directo. Usa listas solo si ayudan.",
    "- Para cualquier dato del club (partidos, fechas, resultados, clasificaciones, actas, jugadores) usa las herramientas. No inventes datos: si una herramienta no lo devuelve, di que no lo tienes.",
    "- Si la pregunta depende del equipo y no se sabe cuál, pregunta si es el A o el B.",
    "- Si varios jugadores empatan en lo que se pregunta (por ejemplo, el mismo porcentaje de victorias), nómbralos a todos con sus partidos.",
    "- No hables de temas ajenos al club o al pádel.",
  ];
  if (role === "coach") lines.push("- Ayuda al entrenador a preparar la jornada: antes de proponer parejas consulta la disponibilidad y las posiciones (derecha/revés), y explica en una frase cada propuesta. Son sugerencias: no se guarda nada.",
    "- Un encuentro tiene 5 parejas: las parejas 1 y 2 valen 3 puntos y las 3, 4 y 5 valen 2. Propón siempre 5 parejas numeradas, con un jugador de derecha y otro de revés cuando se pueda.");
  return lines.join("\n");
}

export async function* runConversation(input: { history: unknown; role: ChatRole; userLabel: string; now: Date; llm: LlmClient; data: ChatData }): AsyncGenerator<ChatEvent> {
  const { role, llm, data } = input;
  const history = trimHistory(input.history);
  if (history.at(-1)?.role !== "user") { yield { tipo: "error", motivo: "Escribe una pregunta." }; return; }
  const messages: LlmMessage[] = [{ role: "system", content: systemPrompt(role, input.userLabel, input.now) }, ...history];
  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      let text = ""; const calls: LlmToolCall[] = [];
      for await (const chunk of llm.stream(messages, round < MAX_ROUNDS ? toolsFor(role) : [])) {
        if (chunk.type === "text") { text += chunk.delta; yield { tipo: "texto", delta: chunk.delta }; }
        else calls.push(...chunk.calls);
      }
      if (!calls.length) { yield { tipo: "fin" }; return; }
      messages.push({ role: "assistant", content: text, tool_calls: calls });
      for (const call of calls) {
        yield { tipo: "herramienta", nombre: call.function.name };
        messages.push({ role: "tool", tool_name: call.function.name, content: await runTool(call.function.name, call.function.arguments, role, data) });
      }
    }
    yield { tipo: "texto", delta: "No he podido completar la consulta. Prueba a preguntarlo de otra forma." };
    yield { tipo: "fin" };
  } catch (error) {
    yield { tipo: "error", motivo: error instanceof ChatUnavailableError ? error.message : "El asistente ha fallado. Inténtalo de nuevo." };
  }
}

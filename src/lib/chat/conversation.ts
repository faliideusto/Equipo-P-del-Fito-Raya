import { ChatUnavailableError } from "./llm-client";
import { runTool, toolsFor, type ChatData } from "./tools";
import type { ChatEvent, ChatRole, HistoryMessage, LlmClient, LlmMessage, LlmToolCall } from "./types";
import type { TeamId } from "@/domain/types";

export const MAX_ROUNDS = 4;
const MAX_HISTORY = 10;
const MAX_CHARS = 2000;
// Small models answer follow-ups ("¿y la siguiente?") from the earlier answer, inventing data; a reminder next to the question stops it.
const FOLLOW_UP = "(Para cualquier dato del club, consulta de nuevo las herramientas; no lo saques de tus respuestas anteriores.)";
// Rounds, times, dates or scores in an answer that consulted nothing are invented: it is held back and asked again once.
const LOOKS_LIKE_DATA = /\bjornada\s*\d|\b\d{1,2}:\d{2}\b|\b\d{1,2} de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b|\b\d+\s*-\s*\d+\b/i;
const RETRY = "Esa respuesta no sale de las herramientas. Consulta ahora la herramienta adecuada y responde solo con lo que devuelva.";
// With "Ambos" the model still tends to ask for one team; unless the user named one, the other team's call is added.
// Separate per-team results: one merged result for both teams confuses it (it then mixes up the highlighted rounds).
const BOTH_TEAMS = new Set(["calendario", "ranking_temporada"]);
const NAMES_TEAM = /\b(?:equipo|el|del|al)\s+[ab]\b/i;
const GAVE_UP = "No he podido completar la consulta. Prueba a preguntarlo de otra forma.";
const UNCHECKED = "No he podido comprobar ese dato. Pregúntalo de nuevo indicando el equipo o la jornada.";

// Only user and assistant turns travel from the browser; system and tool turns are always built here.
export function trimHistory(history: unknown): HistoryMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m): m is HistoryMessage => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0)
    .slice(-MAX_HISTORY)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
}

export function systemPrompt(role: ChatRole, userLabel: string, now: Date, team: TeamId | null = null) {
  const today = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "full", timeStyle: "short" }).format(now);
  const lines = [
    "Eres el asistente de la Escuela Fito Raya, un club de pádel con dos equipos en las Series Nacionales de Pádel (SNP): el equipo A juega en 2ª División Future y el equipo B en 10ª División Future.",
    `Ahora es ${today} (hora de Madrid). Hablas con ${userLabel}.`,
    "Reglas:",
    "- Responde siempre en español, breve y directo. Usa listas solo si ayudan.",
    "- Para cualquier dato del club (partidos, fechas, resultados, clasificaciones, actas, jugadores) usa las herramientas. No inventes datos: si una herramienta no lo devuelve, di que no lo tienes.",
    "- Aunque la pregunta siga a otra (por ejemplo, \"¿y la siguiente?\"), vuelve a consultar las herramientas: nunca saques un dato de los mensajes anteriores ni lo deduzcas.",
    "- Para saber quién jugó, en qué pareja o con qué sets, usa acta (sin jornada da la última jugada) y nombra a los jugadores de cada pareja. Para cuántos encuentros ha ganado o le quedan a un equipo, usa el balance del calendario.",
    team
      ? `- En el chat está seleccionado el equipo ${team.toUpperCase()}: si el usuario no nombra otro equipo, no pases equipo a las herramientas (se usa el ${team.toUpperCase()}) y responde solo para ese equipo. Si nombra el otro, pásalo.`
      : "- En el chat están elegidos los dos equipos: si el usuario no nombra uno, responde para los dos equipos (calendario y ranking_temporada ya devuelven los dos); con el resto de herramientas, pregunta si es el A o el B.",
    "- Cuando una herramienta da un campo resumen o texto, úsalo tal cual en la respuesta, uno por equipo si vienen los dos, sin mezclar datos de un equipo con los del otro.",
    "- Responde a todo lo que se pregunta (por ejemplo día, hora, rival y lugar) y usa el tiempo verbal según la jornada esté jugada o pendiente.",
    "- Para el mejor o el peor jugador, usa el mejor o el peor porcentaje de ranking_temporada (el peor es el porcentaje más bajo) y di que es por porcentaje de victorias.",
    "- Si varios jugadores empatan en lo que se pregunta (por ejemplo, el mismo porcentaje de victorias), nómbralos a todos con sus partidos.",
    "- Puedes dar consejos generales de pádel (golpes como el globo, la bandeja o la víbora, táctica, reglas) sin herramientas. No hables de temas ajenos al club o al pádel.",
  ];
  if (role === "player") lines.push("- No tienes acceso a la disponibilidad, las convocatorias ni las alineaciones: si te preguntan por ellas, dilo y sugiere consultarlo con el entrenador.");
  if (role === "coach") lines.push("- Ayuda al entrenador a preparar la jornada: antes de proponer parejas consulta la disponibilidad y las posiciones (derecha/revés), y explica en una frase cada propuesta. Son sugerencias: no se guarda nada.",
    "- Un encuentro tiene 5 parejas: las parejas 1 y 2 valen 3 puntos y las 3, 4 y 5 valen 2. Propón siempre 5 parejas numeradas, con un jugador de derecha y otro de revés cuando se pueda.");
  return lines.join("\n");
}

export async function* runConversation(input: { history: unknown; role: ChatRole; userLabel: string; now: Date; llm: LlmClient; data: ChatData; team?: TeamId | null }): AsyncGenerator<ChatEvent> {
  const { role, llm, data } = input; const team = input.team ?? null;
  const history = trimHistory(input.history);
  if (history.at(-1)?.role !== "user") { yield { tipo: "error", motivo: "Escribe una pregunta." }; return; }
  const asked = history.length > 1 ? [...history.slice(0, -1), { role: "user" as const, content: `${history.at(-1)!.content}\n\n${FOLLOW_UP}` }] : history;
  const messages: LlmMessage[] = [{ role: "system", content: systemPrompt(role, input.userLabel, input.now, team) }, ...asked];
  try {
    let consulted = false; let retried = false;
    const bothTeams = team === null && !NAMES_TEAM.test(history.at(-1)!.content);
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      // Until a tool has run, the text is held: it may be an invented answer that must not reach the user.
      let text = ""; const calls: LlmToolCall[] = []; const held: string[] = [];
      for await (const chunk of llm.stream(messages, round < MAX_ROUNDS ? toolsFor(role) : [])) {
        if (chunk.type === "text") { text += chunk.delta; if (consulted) yield { tipo: "texto", delta: chunk.delta }; else held.push(chunk.delta); }
        else calls.push(...chunk.calls);
      }
      if (!calls.length) {
        if (!consulted && (!text.trim() || LOOKS_LIKE_DATA.test(text))) {
          if (!retried && round < MAX_ROUNDS - 1) { retried = true; messages.push({ role: "assistant", content: text }, { role: "user", content: RETRY }); continue; }
          yield { tipo: "texto", delta: text.trim() ? UNCHECKED : GAVE_UP }; yield { tipo: "fin" }; return;
        }
        for (const delta of held) yield { tipo: "texto", delta };
        yield { tipo: "fin" }; return;
      }
      consulted = true;
      if (bothTeams) for (const name of BOTH_TEAMS) {
        const teams = calls.filter(c => c.function.name === name).map(c => c.function.arguments.equipo);
        if (teams.length === 1 && (teams[0] === "a" || teams[0] === "b")) calls.push({ function: { name, arguments: { equipo: teams[0] === "a" ? "b" : "a" } } });
      }
      for (const delta of held) yield { tipo: "texto", delta };
      messages.push({ role: "assistant", content: text, tool_calls: calls });
      for (const call of calls) {
        yield { tipo: "herramienta", nombre: call.function.name };
        messages.push({ role: "tool", tool_name: call.function.name, content: await runTool(call.function.name, call.function.arguments, role, data, team) });
      }
    }
    yield { tipo: "texto", delta: GAVE_UP };
    yield { tipo: "fin" };
  } catch (error) {
    yield { tipo: "error", motivo: error instanceof ChatUnavailableError ? error.message : "El asistente ha fallado. Inténtalo de nuevo." };
  }
}

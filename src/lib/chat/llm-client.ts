import type { ChatHealth, LlmChunk, LlmClient } from "./types";

// The model runs on the club PC behind Tailscale Funnel (Laya/pc_servidor/servidor_chat.py).
export class ChatUnavailableError extends Error { override name = "ChatUnavailableError"; }
const OFFLINE = "El asistente está desconectado ahora mismo.";
const BY_STATUS: Record<number, string> = {
  401: "El asistente no acepta la clave configurada en la web.",
  429: "El asistente está respondiendo a otra persona. Prueba en unos segundos.",
  503: OFFLINE,
  504: "El asistente ha tardado demasiado en responder.",
};
type Config = { url: string; key: string };

export function chatConfig(env: Record<string, string | undefined> = process.env): Config | null {
  const url = env.CHAT_LLM_URL?.replace(/\/+$/, ""); const key = env.CHAT_LLM_KEY;
  return url && key ? { url, key } : null;
}

function* chunksOf(line: string): Generator<LlmChunk> {
  if (!line.trim()) return;
  let row;
  try { row = JSON.parse(line); } catch { throw new ChatUnavailableError(OFFLINE); }
  if (row.error) throw new ChatUnavailableError(OFFLINE);
  const message = row.message ?? {};
  if (typeof message.content === "string" && message.content) yield { type: "text", delta: message.content };
  if (Array.isArray(message.tool_calls) && message.tool_calls.length) yield { type: "tools", calls: message.tool_calls };
}

export async function* parseNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<LlmChunk> {
  const reader = body.getReader(); const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
    for (const line of lines) yield* chunksOf(line);
  }
  yield* chunksOf(buffer);
}

export function createLlmClient(config = chatConfig(), fetchImpl: typeof fetch = fetch): LlmClient {
  return {
    async *stream(messages, tools) {
      if (!config) throw new ChatUnavailableError("El asistente no está configurado.");
      let response: Response;
      try {
        response = await fetchImpl(`${config.url}/chat`, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(120000), headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" }, body: JSON.stringify({ messages, tools }) });
      } catch { throw new ChatUnavailableError(OFFLINE); }
      if (!response.ok || !response.body) throw new ChatUnavailableError(BY_STATUS[response.status] ?? OFFLINE);
      try { yield* parseNdjson(response.body); }
      catch (error) { throw error instanceof ChatUnavailableError ? error : new ChatUnavailableError(OFFLINE); }
    },
  };
}

let cached: { at: number; value: ChatHealth } | null = null;
export async function chatHealth(config = chatConfig(), fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<ChatHealth> {
  if (!config) return { disponible: false, motivo: "El asistente no está configurado." };
  if (cached && now - cached.at < 30000) return cached.value;
  let value: ChatHealth;
  try {
    const response = await fetchImpl(`${config.url}/salud`, { cache: "no-store", signal: AbortSignal.timeout(4000), headers: { Authorization: `Bearer ${config.key}` } });
    const data = response.ok ? await response.json() : null;
    value = !data?.ollama ? { disponible: false, motivo: OFFLINE }
      : !data.clave_ok ? { disponible: false, motivo: BY_STATUS[401] }
      : data.laya_entrenando ? { disponible: false, motivo: "El PC del asistente está entrenando otro modelo. Vuelve más tarde." }
      : { disponible: true };
  } catch { value = { disponible: false, motivo: OFFLINE }; }
  cached = { at: now, value };
  return value;
}

// Shared by the chat route, the conversation loop and the tools. Spanish event names travel to the browser.
export type ChatRole = "player" | "coach";
export type LlmToolCall = { function: { name: string; arguments: Record<string, unknown> } };
export type LlmMessage = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: LlmToolCall[]; tool_name?: string };
export type LlmTool = { type: "function"; function: { name: string; description: string; parameters: object } };
export type LlmChunk = { type: "text"; delta: string } | { type: "tools"; calls: LlmToolCall[] };
export interface LlmClient { stream(messages: LlmMessage[], tools: LlmTool[]): AsyncGenerator<LlmChunk> }
export type HistoryMessage = { role: "user" | "assistant"; content: string };
export type ChatEvent = { tipo: "herramienta"; nombre: string } | { tipo: "texto"; delta: string } | { tipo: "fin" } | { tipo: "error"; motivo: string };
export type ChatHealth = { disponible: boolean; motivo?: string };

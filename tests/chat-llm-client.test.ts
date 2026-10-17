import test from "node:test";
import assert from "node:assert/strict";
import { chatConfig, chatHealth, ChatUnavailableError, createLlmClient, parseNdjson } from "../src/lib/chat/llm-client";
import type { LlmChunk } from "../src/lib/chat/types";

const config = { url: "https://pc.example.ts.net", key: "k" };
const body = (text: string) => new Response(text).body!;
const collect = async (gen: AsyncGenerator<LlmChunk>) => { const out: LlmChunk[] = []; for await (const c of gen) out.push(c); return out; };
const line = (message: object, done = false) => JSON.stringify({ message: { role: "assistant", content: "", ...message }, done });

test("sin CHAT_LLM_URL o CHAT_LLM_KEY no hay configuración", () => {
  assert.equal(chatConfig({}), null);
  assert.equal(chatConfig({ CHAT_LLM_URL: "https://x" }), null);
  assert.deepEqual(chatConfig({ CHAT_LLM_URL: "https://x//", CHAT_LLM_KEY: "k" }), { url: "https://x", key: "k" });
});

test("parseNdjson junta líneas partidas y separa texto de herramientas", async () => {
  const text = line({ content: "Ho" }) + "\n" + line({ content: "la" }) + "\n" + line({ tool_calls: [{ function: { name: "calendario", arguments: { equipo: "a" } } }] }, true);
  const half = Math.floor(text.length / 2);
  const stream = new ReadableStream<Uint8Array>({ start(c) { const e = new TextEncoder(); c.enqueue(e.encode(text.slice(0, half))); c.enqueue(e.encode(text.slice(half))); c.close(); } });
  assert.deepEqual(await collect(parseNdjson(stream)), [
    { type: "text", delta: "Ho" }, { type: "text", delta: "la" },
    { type: "tools", calls: [{ function: { name: "calendario", arguments: { equipo: "a" } } }] },
  ]);
});

test("una línea rota o un error del PC a mitad de respuesta lanza ChatUnavailableError", async () => {
  await assert.rejects(collect(parseNdjson(body(line({ content: "Ho" }) + "\n{roto\n"))), ChatUnavailableError);
  await assert.rejects(collect(parseNdjson(body(line({ content: "Ho" }) + "\n" + JSON.stringify({ error: "cortado" }) + "\n"))), ChatUnavailableError);
});

test("createLlmClient envía clave, mensajes y herramientas, y traduce errores HTTP", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const ok = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(line({ content: "hola" }, true) + "\n"); }) as unknown as typeof fetch;
  const chunks = await collect(createLlmClient(config, ok).stream([{ role: "user", content: "hola" }], []));
  assert.deepEqual(chunks, [{ type: "text", delta: "hola" }]);
  assert.equal(calls[0].url, "https://pc.example.ts.net/chat");
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer k");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { messages: [{ role: "user", content: "hola" }], tools: [] });

  for (const [status, pattern] of [[429, /otra persona/], [503, /desconectado/], [401, /clave/]] as const) {
    const fail = (async () => new Response("{}", { status })) as unknown as typeof fetch;
    await assert.rejects(collect(createLlmClient(config, fail).stream([], [])), { name: "ChatUnavailableError", message: pattern });
  }
  const down = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
  await assert.rejects(collect(createLlmClient(config, down).stream([], [])), { message: /desconectado/ });
  await assert.rejects(collect(createLlmClient(null, ok).stream([], [])), { message: /no está configurado/ });
});

test("chatHealth resume /salud y guarda la respuesta 30 segundos", async () => {
  let hits = 0;
  const salud = (data: object) => (async () => { hits++; return Response.json(data); }) as unknown as typeof fetch;
  const t = 1_000_000_000;
  assert.deepEqual(await chatHealth(config, salud({ clave_ok: true, ollama: true, laya_entrenando: false }), t), { disponible: true });
  assert.deepEqual(await chatHealth(config, salud({}), t + 10_000), { disponible: true });
  assert.equal(hits, 1);
  assert.match((await chatHealth(config, salud({ clave_ok: true, ollama: true, laya_entrenando: true }), t + 60_000)).motivo!, /entrenando/);
  assert.match((await chatHealth(config, salud({ clave_ok: false, ollama: true }), t + 120_000)).motivo!, /clave/);
  assert.match((await chatHealth(config, salud({ clave_ok: true, ollama: false }), t + 180_000)).motivo!, /desconectado/);
  const down = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
  assert.equal((await chatHealth(config, down, t + 240_000)).disponible, false);
  assert.deepEqual(await chatHealth(null), { disponible: false, motivo: "El asistente no está configurado." });
});

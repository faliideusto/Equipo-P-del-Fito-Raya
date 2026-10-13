import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/chat/route";
import { allowChat, CHAT_LIMIT } from "../src/lib/chat/rate-limit";

const request = (origin: string, body: string) => new Request("http://localhost/api/chat", { method: "POST", headers: { origin, host: "localhost", "Content-Type": "application/json" }, body });

test("la API del chat rechaza otro origen y conversaciones enormes antes de leer la sesión", async () => {
  assert.equal((await POST(request("http://example.com", JSON.stringify({ messages: [] })))).status, 403);
  const big = await POST(request("http://localhost", "x".repeat(30000)));
  assert.equal(big.status, 413);
  assert.match((await big.json()).error, /Empieza una nueva/);
});

test("límite de mensajes por usuario y hora", () => {
  const t = 5_000_000;
  for (let i = 0; i < CHAT_LIMIT; i++) assert.equal(allowChat("u1", t + i), true);
  assert.equal(allowChat("u1", t + CHAT_LIMIT), false);
  assert.equal(allowChat("u2", t), true);
  assert.equal(allowChat("u1", t + 3_600_001), true);
});

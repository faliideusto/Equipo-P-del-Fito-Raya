import { test } from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../src/app/api/wallet/notify/route";

const post = (origin: string, body: string) => new Request("http://localhost/api/wallet/notify", { method: "POST", headers: { origin, host: "localhost", "Content-Type": "application/json" }, body });

test("la API de avisos rechaza otro origen, cuerpos grandes y datos no válidos antes de leer la sesión", async () => {
  assert.equal((await POST(post("http://example.com", JSON.stringify({ teamId: "a", kind: "result", fixtureId: "40" })))).status, 403);
  assert.equal((await POST(post("http://localhost", "x".repeat(6000)))).status, 413);
  assert.equal((await POST(post("http://localhost", JSON.stringify({ teamId: "c", kind: "result", fixtureId: "40" })))).status, 400);
  assert.equal((await POST(post("http://localhost", JSON.stringify({ teamId: "a", kind: "lineup", fixtureId: "50", lineupId: "no-uuid" })))).status, 400);
  assert.equal((await POST(post("http://localhost", JSON.stringify({ teamId: "a", kind: "otro", fixtureId: "50" })))).status, 400);
  assert.equal((await GET(new Request("http://localhost/api/wallet/notify?teamId=z"))).status, 400);
});

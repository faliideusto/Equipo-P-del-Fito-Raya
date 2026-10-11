import { test } from "node:test";
import assert from "node:assert/strict";
import { POST, DELETE } from "../src/app/api/results/route";
import { resolvePair } from "../src/lib/pending-results-service";

const request = (method: string, origin: string, body: string) => new Request("http://localhost/api/results", { method, headers: { origin, host: "localhost", "Content-Type": "application/json" }, body });

test("la API de resultados rechaza otro origen y cuerpos grandes antes de leer la sesión", async () => {
  assert.equal((await POST(request("POST", "http://example.com", JSON.stringify({ action: "absent", fixtureId: "1", teamId: "a" })))).status, 403);
  assert.equal((await POST(request("POST", "http://localhost", "x".repeat(6000)))).status, 413);
  assert.equal((await DELETE(request("DELETE", "http://example.com", "{}"))).status, 403);
});
test("la pareja fijada por el acta prevalece sobre la enviada", () => {
  assert.equal(resolvePair(3, 1), 3);
  assert.equal(resolvePair(null, 4), 4);
  assert.equal(resolvePair(null, 0), null);
  assert.equal(resolvePair(null, 6), null);
  assert.equal(resolvePair(null, "2"), null);
});

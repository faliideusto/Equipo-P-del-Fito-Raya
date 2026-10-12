import { test } from "node:test";
import assert from "node:assert/strict";
import { DELETE, GET, POST } from "../src/app/api/wallet/notify/route";
import { selectableLineup } from "../src/lib/wallet-notify-service";

const post = (origin: string, body: string) => new Request("http://localhost/api/wallet/notify", { method: "POST", headers: { origin, host: "localhost", "Content-Type": "application/json" }, body });

test("la API de avisos rechaza otro origen, cuerpos grandes y datos no válidos antes de leer la sesión", async () => {
  assert.equal((await POST(post("http://example.com", JSON.stringify({ teamId: "a", kind: "result", fixtureId: "40" })))).status, 403);
  assert.equal((await POST(post("http://localhost", "x".repeat(6000)))).status, 413);
  assert.equal((await POST(post("http://localhost", JSON.stringify({ teamId: "c", kind: "result", fixtureId: "40" })))).status, 400);
  assert.equal((await POST(post("http://localhost", JSON.stringify({ teamId: "a", kind: "lineup", fixtureId: "50", lineupId: "no-uuid" })))).status, 400);
  assert.equal((await POST(post("http://localhost", JSON.stringify({ teamId: "a", kind: "otro", fixtureId: "50" })))).status, 400);
  assert.equal((await POST(post("http://localhost", JSON.stringify({ teamId: "a", kind: "result", fixtureId: "40" })))).status, 400);
  assert.equal((await POST(post("http://localhost", JSON.stringify({ teamId: "a", kind: "lineup", fixtureId: "50", pairs: "x" })))).status, 400);
  assert.equal((await POST(post("http://localhost", JSON.stringify({ teamId: "a", kind: "lineup", fixtureId: "50", pairs: [] })))).status, 400);
  assert.equal((await GET(new Request("http://localhost/api/wallet/notify?teamId=z"))).status, 400);
});
test("una convocatoria publicada con una alineación ya borrada no se preselecciona", () => {
  const saved = [{ id: "11111111-1111-4111-8111-111111111111" }];
  assert.equal(selectableLineup(saved, "11111111-1111-4111-8111-111111111111"), "11111111-1111-4111-8111-111111111111");
  assert.equal(selectableLineup(saved, "22222222-2222-4222-8222-222222222222"), null);
  assert.equal(selectableLineup(saved, null), null);
});
test("borrar la convocatoria exige el mismo origen y datos válidos antes de leer la sesión", async () => {
  const del = (origin: string, body: object) => new Request("http://localhost/api/wallet/notify", { method: "DELETE", headers: { origin, host: "localhost", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await DELETE(del("http://example.com", { teamId: "a", fixtureId: "50" }))).status, 403);
  assert.equal((await DELETE(del("http://localhost", { teamId: "c", fixtureId: "50" }))).status, 400);
  assert.equal((await DELETE(del("http://localhost", { teamId: "a", fixtureId: "abc" }))).status, 400);
});

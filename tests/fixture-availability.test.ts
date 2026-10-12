import test from "node:test";
import assert from "node:assert/strict";
import { saveAvailability, savedAvailability } from "../src/lib/fixture-availability";

process.env.SUPABASE_URL ??= "https://db.example.invalid"; process.env.SUPABASE_SECRET_KEY ??= "fixture-key";
const fake = (reply: () => Response, calls: { url: string; method: string; body: string }[] = []) => (async (input: URL | string, init?: RequestInit) => { calls.push({ url: String(input), method: init?.method ?? "GET", body: String(init?.body ?? "") }); return reply(); }) as typeof fetch;

test("lee la lista guardada de una jornada y distingue lista vacía de nada guardado", async () => {
  const calls: { url: string; method: string; body: string }[] = [];
  assert.deepEqual(await savedAvailability("a", "55262", fake(() => Response.json([{ player_ids: ["a-1", "a-2", 7] }]), calls)), ["a-1", "a-2"]);
  assert.match(calls[0].url, /fixture_availability\?select=player_ids&team_id=eq\.a&fixture_id=eq\.55262/);
  assert.deepEqual(await savedAvailability("a", "55262", fake(() => Response.json([{ player_ids: [] }]))), []);
  assert.equal(await savedAvailability("a", "55262", fake(() => Response.json([]))), null);
});
test("sin la tabla, leer no rompe la página y guardar explica qué falta", async () => {
  const missing = fake(() => Response.json({ code: "PGRST205" }, { status: 404 }));
  assert.equal(await savedAvailability("a", "55262", missing), null);
  await assert.rejects(saveAvailability("a", "55262", ["a-1"], missing), { message: /supabase\/fixture-availability\.sql/, status: 503 });
});
test("guardar sustituye la lista de esa jornada", async () => {
  const calls: { url: string; method: string; body: string }[] = [];
  await saveAvailability("b", "55500", ["b-1"], fake(() => new Response(null, { status: 201 }), calls));
  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].url, /on_conflict=team_id%2Cfixture_id/);
  const body = JSON.parse(calls[0].body);
  assert.deepEqual([body.team_id, body.fixture_id, body.player_ids], ["b", "55500", ["b-1"]]);
});

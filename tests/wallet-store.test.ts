import test from "node:test";
import assert from "node:assert/strict";
import { memoryWalletStore, supabaseWalletStore, type WalletPass } from "../src/lib/wallet-store";

const pass = (over: Partial<WalletPass> = {}): WalletPass => ({ serial: "11111111-1111-4111-8111-111111111111", player_id: "1", team_id: "a", auth_token: "t".repeat(43), google_object_id: null, updated_at: "2026-10-11T10:00:00.000Z", ...over });

test("memoria: una tarjeta por jugador y equipo", async () => {
  const store = memoryWalletStore();
  await store.createPass(pass());
  const again = await store.createPass(pass({ serial: "22222222-2222-4222-8222-222222222222" }));
  assert.equal(again.serial, "11111111-1111-4111-8111-111111111111");
  await store.createPass(pass({ serial: "33333333-3333-4333-8333-333333333333", team_id: "b" }));
  assert.equal((await store.teamPasses("a")).length, 1);
  assert.equal((await store.passFor("1", "b"))?.serial, "33333333-3333-4333-8333-333333333333");
});
test("memoria: dispositivos, baja por token y tarjetas de un dispositivo", async () => {
  const store = memoryWalletStore(); await store.createPass(pass());
  assert.equal(await store.addDevice({ device_id: "d1", serial: pass().serial, push_token: "aa" }), "created");
  assert.equal(await store.addDevice({ device_id: "d1", serial: pass().serial, push_token: "bb" }), "exists");
  assert.equal(store.devices[0].push_token, "bb");
  assert.deepEqual((await store.devicePasses("d1")).map(p => p.serial), [pass().serial]);
  await store.removePushToken("bb");
  assert.deepEqual(await store.devicesFor([pass().serial]), []);
});
test("memoria: publicar sustituye la convocatoria de la misma jornada", async () => {
  const store = memoryWalletStore();
  const row = { team_id: "a" as const, fixture_id: "50", lineup_id: null, pairs: [], published_at: "x" };
  await store.publishLineup(row); await store.publishLineup({ ...row, published_at: "y" });
  assert.equal(store.lineups.length, 1);
  assert.equal((await store.publishedLineup("a", "50"))?.published_at, "y");
  assert.equal(await store.publishedLineup("b", "50"), null);
});
test("supabase: filtros, upsert y tabla ausente", async () => {
  const calls: { url: string; method: string; prefer: string }[] = [];
  const fake = (async (input: URL | string, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? "GET", prefer: new Headers(init?.headers).get("Prefer") ?? "" });
    return Response.json([]);
  }) as typeof fetch;
  const store = supabaseWalletStore({ url: "https://db.example.com", key: "sb_secret_x" }, fake);
  await store.devicesFor(["s1", "s2"]);
  await store.publishLineup({ team_id: "a", fixture_id: "50", lineup_id: null, pairs: [], published_at: "x" });
  assert.match(calls[0].url, /wallet_devices\?select=device_id%2Cserial%2Cpush_token&serial=in.%28s1%2Cs2%29/);
  assert.equal(calls[1].method, "POST");
  assert.match(calls[1].url, /on_conflict=team_id%2Cfixture_id/);
  assert.match(calls[1].prefer, /merge-duplicates/);
  const missing = supabaseWalletStore({ url: "https://db.example.com", key: "k" }, (async () => Response.json({ code: "PGRST205" }, { status: 404 })) as typeof fetch);
  await assert.rejects(missing.passBySerial("s"), { message: /supabase\/wallet\.sql/, status: 503 });
  assert.deepEqual(await missing.devicesFor([]), []);
});

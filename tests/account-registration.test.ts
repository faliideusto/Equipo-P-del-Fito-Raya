import { test } from "node:test";
import assert from "node:assert/strict";
import { registerLinkedAccount } from "../src/lib/account-registration";
import { clubRepository } from "../src/data/repository";
import { registrationRoster, requireRosterSelection } from "../src/lib/account-roster";
import { POST } from "../src/app/api/account/route";

test("registration requires a roster player, shares A/B identity and rolls back conflicting accounts", async () => {
  const oldFetch = globalThis.fetch; const oldUrl = process.env.SUPABASE_URL; const oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://db.example.invalid"; process.env.SUPABASE_SECRET_KEY = "fixture-key";
  const calls: { url: string; method?: string; body?: string }[] = [];
  let conflict = false; let duplicateEmail = false;
  const oldPlayers = clubRepository.getPlayers;
  clubRepository.getPlayers = async teamId => [{ id: "b-381423", sourceId: "381423", name: "Jugador de prueba", teamId, points: 0, position: null }];
  const id = "11111111-1111-4111-8111-111111111111";
  globalThis.fetch = async (input, init) => {
    const url = String(input); calls.push({ url, method: init?.method, body: init?.body?.toString() });
    let response: Response;
    if (url.includes("/rpc/link_player_account")) response = new Response(null, { status: conflict ? 409 : 204 });
    else if (url.includes("/player_accounts")) response = Response.json([{ user_id: id, snp_user_id: null, player_id: "381423", position: "LEFT" }]);
    else if (url.endsWith("/admin/users")) response = duplicateEmail ? new Response(null, { status: 422 }) : Response.json({ id });
    else if (url.includes("/admin/users/")) response = new Response(null, { status: 204 });
    else if (url.includes("/token?")) response = Response.json({ access_token: "fixture-access", refresh_token: "fixture-refresh", user: { id }, expires_in: 3600 });
    else throw new Error("Unexpected fixture request");
    Object.defineProperty(response, "url", { value: url }); return response;
  };
  try {
    const request = new Request("http://localhost:3000/api/account", { method: "POST", headers: { origin: "http://localhost:3000" }, body: JSON.stringify({ action: "signup", email: "test@example.invalid", password: "fixture-web-only-password", position: "LEFT" }) });
    assert.equal((await POST(request)).status, 400); assert.equal(calls.length, 0);
    assert.throws(() => requireRosterSelection("c", "381423"), /Elige tu equipo/);
    assert.throws(() => requireRosterSelection("a", "invalid"), /Elige tu equipo/);
    await assert.rejects(registerLinkedAccount("test@example.invalid", "fixture-web-only-password", "LEFT", "a", "999999"), /no aparece/);
    assert.ok(!calls.some(call => call.url.includes("/admin/users")));
    calls.length = 0;
    const session = await registerLinkedAccount("test@example.invalid", "fixture-web-only-password", "LEFT", "a", "381423");
    assert.equal(session.user.id, id);
    const rpc = calls.find(call => call.url.includes("/rpc/"))!;
    assert.equal(JSON.parse(rpc.body!).p_player_id, "381423");
    assert.equal(JSON.parse(rpc.body!).p_snp_user_id, null);
    assert.ok(!calls.some(call => /snpgalaxy/.test(call.url)));
    const choices = await registrationRoster("b");
    assert.deepEqual(choices, [{ id: "381423", name: "Jugador de prueba", available: false }]);
    calls.length = 0; conflict = true;
    await assert.rejects(registerLinkedAccount("other@example.invalid", "fixture-web-only-password", "LEFT", "b", "381423"), /otra cuenta/);
    assert.ok(calls.some(call => call.method === "DELETE" && call.url.endsWith(`/admin/users/${id}`)));
    calls.length = 0; duplicateEmail = true;
    await assert.rejects(registerLinkedAccount("test@example.invalid", "fixture-web-only-password", "LEFT", "a", "381423"), /ya tienes una/);
    assert.ok(!calls.some(call => call.method === "DELETE"));
  } finally { clubRepository.getPlayers = oldPlayers; globalThis.fetch = oldFetch; if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl; if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey; }
});


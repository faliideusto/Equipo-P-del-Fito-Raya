import { test } from "node:test";
import assert from "node:assert/strict";
import { registerLinkedAccount } from "../src/lib/account-registration";
import { POST } from "../src/app/api/account/route";

test("registration requires verified SNP before creating and linking an account, and rolls back conflicts", async () => {
  const oldFetch = globalThis.fetch; const oldUrl = process.env.SUPABASE_URL; const oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://db.example.invalid"; process.env.SUPABASE_SECRET_KEY = "fixture-key";
  const calls: { url: string; method?: string; body?: string }[] = [];
  let invalidSnp = false; let conflict = false; let duplicateEmail = false;
  const id = "11111111-1111-4111-8111-111111111111";
  globalThis.fetch = async (input, init) => {
    const url = String(input); calls.push({ url, method: init?.method, body: init?.body?.toString() });
    let response: Response;
    if (url === "https://snpgalaxy.com/usuario/login") response = new Response(init?.method === "POST" && !invalidSnp ? '<a href="/country">España - SNP</a>' : '<form action="/usuario/login"><input name="password"></form>');
    else if (url === "https://snpgalaxy.com/country") response = new Response('<iframe id="iframep" src="https://seriesnacionalesdepadel.snpgalaxy.com/inicio"></iframe>');
    else if (url === "https://seriesnacionalesdepadel.snpgalaxy.com/inicio") response = new Response('<script>userG = {"id":162797}; rankingJugadorNacional = {"idjugador":381423};</script>');
    else if (url.includes("/rpc/link_player_account")) response = new Response(null, { status: conflict ? 409 : 204 });
    else if (url.includes("/player_accounts")) response = Response.json([{ user_id: id, snp_user_id: "162797", player_id: "381423", position: "LEFT" }]);
    else if (url.endsWith("/admin/users")) response = duplicateEmail ? new Response(null, { status: 422 }) : Response.json({ id });
    else if (url.includes("/admin/users/")) response = new Response(null, { status: 204 });
    else if (url.includes("/token?")) response = Response.json({ access_token: "fixture-access", refresh_token: "fixture-refresh", user: { id }, expires_in: 3600 });
    else throw new Error("Unexpected fixture request");
    Object.defineProperty(response, "url", { value: url }); return response;
  };
  try {
    const request = new Request("http://localhost:3000/api/account", { method: "POST", headers: { origin: "http://localhost:3000" }, body: JSON.stringify({ action: "signup", email: "test@example.invalid", password: "fixture-web-only-password", position: "LEFT" }) });
    assert.equal((await POST(request)).status, 400); assert.equal(calls.length, 0);
    invalidSnp = true;
    await assert.rejects(registerLinkedAccount("test@example.invalid", "fixture-web-only-password", "LEFT", "snp@example.invalid", "fixture-snp-only-password"), /verificar tu ficha/);
    assert.ok(!calls.some(call => call.url.includes("/admin/users")));
    invalidSnp = false; calls.length = 0;
    const session = await registerLinkedAccount("test@example.invalid", "fixture-web-only-password", "LEFT", "snp@example.invalid", "fixture-snp-only-password");
    assert.equal(session.user.id, id);
    const rpc = calls.find(call => call.url.includes("/rpc/"))!;
    assert.equal(JSON.parse(rpc.body!).p_player_id, "381423");
    assert.ok(!calls.filter(call => call.url.includes("db.example.invalid")).some(call => call.body?.includes("fixture-snp-only-password")));
    calls.length = 0; conflict = true;
    await assert.rejects(registerLinkedAccount("other@example.invalid", "fixture-web-only-password", "LEFT", "snp@example.invalid", "fixture-snp-only-password"), /otra cuenta/);
    assert.ok(calls.some(call => call.method === "DELETE" && call.url.endsWith(`/admin/users/${id}`)));
    calls.length = 0; duplicateEmail = true;
    await assert.rejects(registerLinkedAccount("test@example.invalid", "fixture-web-only-password", "LEFT", "snp@example.invalid", "fixture-snp-only-password"), /ya tienes una/);
    assert.ok(!calls.some(call => call.method === "DELETE"));
  } finally { globalThis.fetch = oldFetch; if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl; if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey; }
});

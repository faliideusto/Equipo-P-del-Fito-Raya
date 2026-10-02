import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/account/route";
import { playerLink } from "../src/lib/account-profile";
test("account API rejects foreign origins and invalid registration before talking to Auth", async () => {
  const request = (body: object, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/account", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body) });
  assert.equal((await POST(request({ action: "signup" }, "https://other.invalid"))).status, 403);
  assert.equal((await POST(request({ action: "signup", email: "member@example.invalid", password: "long-enough-pass", position: "invalid" }))).status, 400);
  assert.equal((await POST(request({ action: "signup", email: "member@example.invalid", password: "", position: "LEFT" }))).status, 400);
  const proxied = new Request("http://localhost:10000/api/account", { method: "POST", headers: { host: "escuelafitoraya.onrender.com", origin: "https://escuelafitoraya.onrender.com" }, body: JSON.stringify({action:"signup",email:"bad"}) });
  assert.equal((await POST(proxied)).status,400);
});
test("verified link uses one atomic RPC and never sends a password to storage", async () => {
  const originalFetch = globalThis.fetch; const oldUrl = process.env.SUPABASE_URL; const oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://db.example.invalid"; process.env.SUPABASE_SECRET_KEY = "test-only-key";
  const requests: { url: string; body?: Record<string, unknown> }[] = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (String(url).includes("/rpc/")) return new Response(null, { status: 204 });
    return Response.json([{ user_id: "account-owned-by-server", snp_user_id: "162797", player_id: "381423", position: "LEFT" }]);
  };
  try {
    await playerLink("account-owned-by-server", { userId: "162797", playerId: "381423", position: "LEFT" });
    assert.ok(requests[0].url.endsWith("/rpc/link_player_account"));
    assert.deepEqual(requests[0].body, { p_user_id: "account-owned-by-server", p_snp_user_id: "162797", p_player_id: "381423", p_position: "LEFT" });
    globalThis.fetch = async () => new Response(null, { status: 409 });
    await assert.rejects(playerLink("other-account", { userId: "162797", playerId: "381423", position: "LEFT" }), /otra cuenta/);
  } finally { globalThis.fetch = originalFetch; if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl; if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey; }
});

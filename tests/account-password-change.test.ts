import { test } from "node:test";
import assert from "node:assert/strict";
import { changeAccountPassword, providerPassword, requestPasswordReset, resetAccountPassword } from "../src/lib/account-password";
import { POST } from "../src/app/api/account/route";

type Sent = { url: string; method: string; body?: Record<string, unknown>; token?: string };
async function withAuth(handler: (sent: Sent) => Response, run: (sent: Sent[]) => Promise<void>) {
  const oldFetch = globalThis.fetch; const oldUrl = process.env.SUPABASE_URL; const oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://db.example.invalid"; process.env.SUPABASE_SECRET_KEY = "fixture-key";
  const sent: Sent[] = [];
  globalThis.fetch = async (input, init) => {
    const request: Sent = { url: String(input), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined, token: new Headers(init?.headers).get("Authorization")?.slice(7) };
    sent.push(request); return handler(request);
  };
  try { await run(sent); } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
}
const session = (token: string) => Response.json({ access_token: token, refresh_token: "r", expires_in: 3600, user: { id: "u" } });

test("changing the password proves the current one and stores the new provider credential", async () => {
  await withAuth(({ url, method, body }) => {
    if (url.includes("grant_type=password")) return body?.password === providerPassword("old") ? session("fresh") : body?.password === providerPassword("new") ? session("after") : Response.json({}, { status: 400 });
    if (method === "PUT") return Response.json({});
    return Response.json({}, { status: 500 });
  }, async sent => {
    assert.equal((await changeAccountPassword("member@example.invalid", "old", "new")).access_token, "after");
    const update = sent.find(row => row.method === "PUT")!;
    assert.equal(update.token, "fresh"); assert.deepEqual(update.body, { password: providerPassword("new") });
    sent.length = 0;
    await assert.rejects(changeAccountPassword("member@example.invalid", "wrong", "new"), /actual no es correcta/);
    assert.ok(!sent.some(row => row.method === "PUT"));
  });
});

test("recovery does not reveal unknown emails and reset uses the link token", async () => {
  await withAuth(({ url, method }) => {
    if (url.includes("/recover")) return Response.json({}, { status: 400 });
    if (url.endsWith("/user") && method === "GET") return Response.json({ id: "u", email: "member@example.invalid" });
    if (method === "PUT") return Response.json({});
    return session("after");
  }, async sent => {
    await requestPasswordReset("nobody@example.invalid", "https://club.example/acceso");
    assert.match(sent[0].url, /recover\?redirect_to=https%3A%2F%2Fclub\.example%2Facceso$/);
    sent.length = 0;
    assert.equal((await resetAccountPassword("link-token", "new")).access_token, "after");
    assert.equal(sent.find(row => row.method === "PUT")!.token, "link-token");
  });
  await withAuth(() => Response.json({}, { status: 401 }), async () => {
    await assert.rejects(resetAccountPassword("expired", "new"), /caducado/);
  });
});

test("password API actions validate input and require a session", async () => {
  const request = (body: object) => new Request("http://localhost:3000/api/account", { method: "POST", headers: { "Content-Type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify(body) });
  assert.equal((await POST(request({ action: "recover", email: "not-an-email" }))).status, 400);
  assert.equal((await POST(request({ action: "reset", password: "x" }))).status, 401);
});

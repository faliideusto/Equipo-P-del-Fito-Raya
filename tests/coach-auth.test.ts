import { test } from "node:test";
import assert from "node:assert/strict";
import { changeCoachPassword, verifyCoachPassword } from "../src/lib/coach-auth";
test("Changing the coach password persists only a hash and invalidates the initial password", async () => {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, password: process.env.POSITIONS_ADMIN_PASSWORD, fetch: globalThis.fetch };
  process.env.SUPABASE_URL = "https://test.invalid"; process.env.SUPABASE_SECRET_KEY = "test-key"; process.env.POSITIONS_ADMIN_PASSWORD = "initial-test";
  let saved: { salt: string; hash: string } | null = null;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === "POST") { saved = JSON.parse(init.body as string); return new Response(null, { status: 201 }); }
    return Response.json(saved ? [saved] : []);
  };
  try {
    assert.equal(await verifyCoachPassword("initial-test"), true);
    await changeCoachPassword("x");
    assert.equal(await verifyCoachPassword("initial-test"), false);
    assert.equal(await verifyCoachPassword("x"), true);
    assert.equal(saved && Object.hasOwn(saved, "password"), false);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [key, value] of Object.entries({ SUPABASE_URL: previous.url, SUPABASE_SECRET_KEY: previous.key, POSITIONS_ADMIN_PASSWORD: previous.password })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

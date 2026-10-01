import { test } from "node:test";
import assert from "node:assert/strict";
import { createCoachToken, verifyCoachToken } from "../src/lib/coach-session";
import { changeCoachPassword, verifyCoachPassword } from "../src/lib/coach-auth";
import { proxy } from "../src/proxy";
import { NextRequest } from "next/server";

test("coach sessions resist forgery and expire on password rotation", async () => {
  const previous = { fetch: globalThis.fetch, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, password: process.env.POSITIONS_ADMIN_PASSWORD };
  process.env.SUPABASE_URL = "https://db.example.invalid"; process.env.SUPABASE_SECRET_KEY = "fixture-key"; process.env.POSITIONS_ADMIN_PASSWORD = "fixture-initial-only";
  let credential: object | null = null;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === "POST") { credential = JSON.parse(String(init.body)); return new Response(null, { status: 201 }); }
    return Response.json(credential ? [credential] : []);
  };
  try {
    assert.equal(await verifyCoachPassword("fixture-initial-only"), true);
    const token = await createCoachToken();
    assert.equal(await verifyCoachToken(token), true);
    assert.equal(await verifyCoachToken(token + "forged"), false);
    assert.equal(await verifyCoachToken(Buffer.from('{"user":"fitoraya"}').toString("base64url") + ".forged"), false);
    assert.equal((await proxy(new NextRequest("https://club.example.invalid/entrenador", { headers: { cookie: `fito-coach=${token}` } }))).headers.get("x-middleware-next"), "1");
    await changeCoachPassword("fixture-new-only-password");
    assert.equal(await verifyCoachToken(token), false);
    assert.equal(await verifyCoachPassword("fixture-initial-only"), false);
    assert.equal(await verifyCoachPassword("fixture-new-only-password"), true);
    assert.equal(await verifyCoachToken(await createCoachToken()), true);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [name, value] of [["SUPABASE_URL", previous.url], ["SUPABASE_SECRET_KEY", previous.key], ["POSITIONS_ADMIN_PASSWORD", previous.password]]) { if (value === undefined) delete process.env[name!]; else process.env[name!] = value; }
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { providerPassword, signInAccount } from "../src/lib/account-password";

test("short passwords sign in through a provider credential and old accounts still work", async () => {
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.SUPABASE_URL; const oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://db.example.invalid"; process.env.SUPABASE_SECRET_KEY = "fixture-key";
  const sent: string[] = []; let legacy = false; let limited = false;
  globalThis.fetch = async (_input, init) => {
    const password = JSON.parse(String(init?.body)).password; sent.push(password);
    return Response.json({}, { status: limited ? 429 : legacy && password !== "old-password" ? 400 : 200 });
  };
  try {
    assert.equal((await signInAccount("member@example.invalid", "x")).status, 200);
    assert.equal(sent[0], providerPassword("x"));
    assert.match(sent[0], /[a-z]/); assert.match(sent[0], /[A-Z]/); assert.match(sent[0], /[0-9]/); assert.match(sent[0], /!/);
    assert.equal(sent[0].length, 72);
    assert.notEqual(providerPassword("x"), providerPassword("X"));
    legacy = true; sent.length = 0;
    assert.equal((await signInAccount("member@example.invalid", "old-password")).status, 200);
    assert.deepEqual(sent, [providerPassword("old-password"), "old-password"]);
    limited = true; sent.length = 0;
    assert.equal((await signInAccount("member@example.invalid", "x")).status, 429);
    assert.equal(sent.length, 1);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});

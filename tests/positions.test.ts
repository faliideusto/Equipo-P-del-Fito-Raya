import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readPositions, savePositions, hasPersistentPositions } from "../src/lib/player-positions";

test("conserva posiciones de ambos equipos y serializa escrituras simultáneas", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fito-positions-"));
  const previous = process.env.PLAYER_POSITIONS_FILE;
  process.env.PLAYER_POSITIONS_FILE = path.join(directory, "positions.json");
  try {
    assert.deepEqual(await readPositions(), {});
    await Promise.all([savePositions({ "a-1": "LEFT" }), savePositions({ "b-2": "RIGHT" })]);
    assert.deepEqual(await readPositions(), { "a-1": "LEFT", "b-2": "RIGHT" });
    await savePositions({ "a-1": "BOTH" });
    assert.deepEqual(await readPositions(), { "a-1": "BOTH", "b-2": "RIGHT" });
    await savePositions({ "b-2": null });
    assert.deepEqual(await readPositions(), { "a-1": "BOTH", "b-2": null });
  } finally {
    if (previous === undefined) delete process.env.PLAYER_POSITIONS_FILE;
    else process.env.PLAYER_POSITIONS_FILE = previous;
    await rm(directory, { recursive: true });
  }
});

test("usa Supabase desde el servidor y bloquea el disco efímero de Render", async () => {
  const original = { fetch: globalThis.fetch, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, render: process.env.RENDER };
  const requests: { method: string; body?: string | null }[] = [];
  try {
    process.env.RENDER = "true";
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SECRET_KEY;
    assert.equal(hasPersistentPositions(), false);
    await assert.rejects(savePositions({ "a-1": "LEFT" }));
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "test-secret";
    globalThis.fetch = async (input, options) => {
      assert.match(String(input), /^https:\/\/example\.supabase\.co\/rest\/v1\/player_positions/);
      assert.equal((options?.headers as Record<string, string>).apikey, "test-secret");
      requests.push({ method: options?.method || "GET", body: options?.body as string | undefined });
      return options?.method === "GET" ? Response.json([{ id: "a-1", position: "LEFT" }]) : new Response(null, { status: 201 });
    };
    assert.equal(hasPersistentPositions(), true);
    assert.deepEqual(await readPositions(), { "a-1": "LEFT" });
    await savePositions({ "b-2": "BOTH" });
    assert.deepEqual(JSON.parse(requests[1].body!), [{ id: "b-2", position: "BOTH" }]);
    globalThis.fetch = async () => new Response(null, { status: 503 });
    await assert.rejects(savePositions({ "b-2": "RIGHT" }), /almacenamiento/);
  } finally {
    globalThis.fetch = original.fetch;
    for (const [key, value] of Object.entries({ SUPABASE_URL: original.url, SUPABASE_SECRET_KEY: original.key, RENDER: original.render })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

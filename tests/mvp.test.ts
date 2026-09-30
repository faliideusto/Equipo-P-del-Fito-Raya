import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/mvp/route";
import { mvpAwards, type MvpAward } from "../src/lib/mvp";
test("MVP edition requires password and same origin", async () => {
  const request = (origin: string) => new Request("http://localhost/api/mvp", { method: "POST", headers: { origin, host: "localhost" }, body: JSON.stringify({ action: "save", teamId: "a", month: "2026-09", playerId: "a-1" }) });
  assert.equal((await POST(request("http://example.com"))).status, 403);
  assert.equal((await POST(request("http://localhost"))).status, 401);
});
test("MVP storage upserts by team and month without overwriting the other team", async () => {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, fetch: globalThis.fetch };
  process.env.SUPABASE_URL = "https://test.invalid"; process.env.SUPABASE_SECRET_KEY = "test-key";
  let rows: MvpAward[] = [];
  globalThis.fetch = async (url, init) => {
    if (init?.method === "POST") {
      assert.equal(new URL(String(url)).searchParams.get("on_conflict"), "team_id,month");
      const row = JSON.parse(init.body as string) as MvpAward;
      rows = rows.filter(old => old.team_id !== row.team_id || old.month !== row.month); rows.push(row);
      return new Response(null, { status: 201 });
    }
    return Response.json(rows);
  };
  const award: MvpAward = { team_id: "a", month: "2026-09", player_id: "a-1", source_id: "1", name: "Jugador", photo_url: null, updated_at: new Date().toISOString() };
  try {
    await mvpAwards(award); await mvpAwards({ ...award, team_id: "b" });
    const result = await mvpAwards({ ...award, player_id: "a-2" });
    assert.equal(result.length, 2); assert.equal(result.find(r => r.team_id === "a")?.player_id, "a-2"); assert.equal(result.find(r => r.team_id === "b")?.player_id, "a-1");
  } finally { globalThis.fetch = previous.fetch; for (const [key, value] of Object.entries({ SUPABASE_URL: previous.url, SUPABASE_SECRET_KEY: previous.key })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});

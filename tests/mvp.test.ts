import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/mvp/route";
import { mvpAwards, type MvpAward } from "../src/lib/mvp";
test("MVP edition requires a coach session and same origin", async () => {
  const request = (origin: string) => new Request("http://localhost/api/mvp", { method: "POST", headers: { origin, host: "localhost" }, body: JSON.stringify({ action: "save", teamId: "a", month: "2026-09", playerId: "a-1" }) });
  assert.equal((await POST(request("http://example.com"))).status, 403);
  assert.equal((await POST(request("http://localhost"))).status, 401);
});
test("MVP storage upserts by team and month without overwriting the other team", async () => {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, fetch: globalThis.fetch };
  process.env.SUPABASE_URL = "https://test.invalid"; process.env.SUPABASE_SECRET_KEY = "test-key";
  let rows: MvpAward[] = [];
  globalThis.fetch = async (url, init) => {
    if (init?.method === "DELETE") {
      const params = new URL(String(url)).searchParams;
      rows = rows.filter(row => `eq.${row.team_id}` !== params.get("team_id") || `eq.${row.month}` !== params.get("month"));
      return new Response(null, { status: 204 });
    }
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
    await mvpAwards({ ...award, month: "2026-08" });
    const cleared = await mvpAwards(undefined, { team_id: "a", month: "2026-09" });
    assert.equal(cleared.length, 2);
    assert.ok(cleared.some(row => row.team_id === "b" && row.month === "2026-09"));
    assert.ok(cleared.some(row => row.team_id === "a" && row.month === "2026-08"));
  } finally { globalThis.fetch = previous.fetch; for (const [key, value] of Object.entries({ SUPABASE_URL: previous.url, SUPABASE_SECRET_KEY: previous.key })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
test("el MVP del mes anterior lleva la carta IF durante el mes en curso", async () => {
  const { clubMonth, previousMonth, inFormIds, isInForm } = await import("../src/domain/mvp");
  assert.equal(previousMonth("2026-10"), "2026-09"); assert.equal(previousMonth("2027-01"), "2026-12");
  // Medianoche del 1 de noviembre en Madrid todavía es octubre en UTC.
  assert.equal(clubMonth(new Date("2026-10-31T23:30:00Z")), "2026-11");
  const awards = [{ month: "2026-09", player_id: "a-3", source_id: "381480" }, { month: "2026-10", player_id: "b-1", source_id: "999" }, { month: "2026-08", player_id: "a-9", source_id: "111" }];
  const october = inFormIds(awards, new Date("2026-10-13T10:00:00Z"));
  assert.deepEqual(october, ["a-3", "381480"]);
  assert.equal(isInForm({ id: "a-3" }, october), true);
  assert.equal(isInForm({ id: "b-7", sourceId: "381480" }, october), true, "la misma persona en el otro equipo");
  assert.equal(isInForm({ id: "b-1", sourceId: "999" }, october), false, "el MVP de este mes la estrena el mes que viene");
  assert.deepEqual(inFormIds(awards, new Date("2026-11-02T10:00:00Z")), ["b-1", "999"]);
});

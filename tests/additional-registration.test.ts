import { test } from "node:test";
import assert from "node:assert/strict";
import { clubRepository } from "../src/data/repository";
import { snpClient } from "../src/lib/snp-client";
import { fullPlayerName, localPlayerId, nameKey } from "../src/lib/club-members";
import { resolveNewMember, searchRegistrationNames } from "../src/lib/registration-search";
import { registerAdditionalAccount } from "../src/lib/account-registration";
import { clubRoster } from "../src/data/club-roster";
import { getSnpPlayer } from "../src/lib/snp-service";

test("additional registration resolves real players, creates zero-point members and rolls back duplicate accounts", async () => {
  const oldFetch = globalThis.fetch, oldAjax = snpClient.ajax, oldPlayers = clubRepository.getPlayers;
  const oldUrl = process.env.SUPABASE_URL, oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://fixture.invalid"; process.env.SUPABASE_SECRET_KEY = "fixture-key";
  let results: Record<string, unknown>[] = []; let offline = false; let conflict = false;
  let members: { player_id: string; name: string; name_key: string; teams: string[]; points: number; photo_url: null }[] = [];
  const calls: { url: string; method?: string; body?: string }[] = [];
  const userId = "11111111-1111-4111-8111-111111111111";
  clubRepository.getPlayers = async () => [];
  snpClient.ajax = async () => { if (offline) throw new Error("offline"); return { entities: results }; };
  globalThis.fetch = async (input, init) => {
    const url = String(input); calls.push({ url, method: init?.method, body: init?.body?.toString() });
    if (url.includes("/club_players")) return Response.json(members);
    if (url.endsWith("/admin/users")) return Response.json({ id: userId });
    if (url.includes("/admin/users/")) return new Response(null, { status: 204 });
    if (url.includes("/rpc/register_club_account")) return new Response(null, { status: conflict ? 409 : 204 });
    if (url.includes("/token?")) return Response.json({ user: { id: userId }, access_token: "fixture", refresh_token: "fixture", expires_in: 3600 });
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    assert.equal(nameKey("  Rubén   Ramírez "), "ruben ramirez");
    assert.throws(() => fullPlayerName("Pepe"), /nombre y apellidos/);
    results = [{ id: 381423, nombre: "Rafael", apellidos: "Deusto" }];
    assert.deepEqual((await searchRegistrationNames("Rafael Deusto")).players, [{ id: "381423", name: "Rafael Deusto" }]);
    await assert.rejects(resolveNewMember("Rafael Deusto", ""), /Selecciona tu jugador/);
    await assert.rejects(resolveNewMember("Rafael Deusto", "999"), /jugadores encontrados/);
    results = [];
    const player = await resolveNewMember("Jugador Nuevo Apellidos", "");
    assert.equal(localPlayerId(player.id), true); assert.equal(player.points, 0);
    const roster = clubRoster("b", [], [], {}, [player], { [player.id]: "LEFT" }).filter(row => row.sourceId === player.id);
    assert.equal(roster[0].name, "Jugador Nuevo Apellidos"); assert.equal(roster[0].position, "LEFT"); assert.equal(roster[0].points, 0);
    const session = await registerAdditionalAccount("fixture@example.invalid", "x", "RIGHT", "b", "Jugador Nuevo Apellidos", "");
    assert.equal(session.user.id, userId);
    const rpc = JSON.parse(calls.find(call => call.url.includes("/rpc/register_club_account"))!.body!);
    assert.equal(rpc.p_team_id, "b"); assert.equal(rpc.p_position, "RIGHT"); assert.equal(rpc.p_points, 0); assert.equal(localPlayerId(rpc.p_player_id), true);
    members = [{ player_id: player.id, name: player.name, name_key: nameKey(player.name), teams: ["b"], points: 0, photo_url: null }];
    assert.equal((await resolveNewMember("Jugador Nuevo Apellidos", "")).id, player.id);
    const profile = await getSnpPlayer(player.id);
    assert.equal(profile.data.points, 0); assert.equal(profile.stale, false); assert.equal(profile.data.statsError, undefined);
    offline = true;
    assert.equal((await searchRegistrationNames(player.name)).unavailable, true);
    conflict = true; calls.length = 0;
    await assert.rejects(registerAdditionalAccount("another@example.invalid", "x", "LEFT", "a", player.name, ""), /ya tiene cuenta/);
    assert.ok(calls.some(call => call.method === "DELETE" && call.url.endsWith(userId)));
  } finally {
    globalThis.fetch = oldFetch; snpClient.ajax = oldAjax; clubRepository.getPlayers = oldPlayers;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});

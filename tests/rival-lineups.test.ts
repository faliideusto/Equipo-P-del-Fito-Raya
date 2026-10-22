import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { SnpFixture } from "../src/domain/snp";
import { cleanRivalPairs } from "../src/domain/rival-lineup";
import { emptyLineup } from "../src/domain/rules";
import type { Pair } from "../src/domain/types";
import { canPrepareRivals, nextRivalFixture } from "../src/lib/rival-preparation";
import { clearRivalLineup, readRivalLineup, saveRivalLineup } from "../src/lib/rival-lineups";

const lineup = (...players: (string | null)[]): Pair[] => emptyLineup().map((pair, index) => ({ ...pair, players: [players[index * 2] ?? null, players[index * 2 + 1] ?? null] }));

test("la alineación del rival solo admite jugadores de su plantilla y sin repetir", () => {
  const squad = ["1", "2", "3", "4"];
  assert.deepEqual(cleanRivalPairs(lineup("1", "2", "3"), squad)?.[1].players, ["3", null]);
  assert.equal(cleanRivalPairs(lineup("1", "1"), squad), null);
  assert.equal(cleanRivalPairs(lineup("1", "99"), squad), null);
  assert.equal(cleanRivalPairs(lineup(), squad), null);
  assert.equal(cleanRivalPairs(lineup("1").slice(0, 4), squad), null);
  assert.equal(cleanRivalPairs(lineup("1").map(pair => ({ ...pair, id: "x" })), squad), null);
  assert.equal(cleanRivalPairs("nada", squad), null);
});

test("el próximo rival sale del calendario del propio equipo, local o visitante", () => {
  const fixture = (id: string, round: number, homeId: string, awayId: string, score: [number, number] | null = null): SnpFixture =>
    ({ id, round, homeId, awayId, homeName: `${homeId}_club`, awayName: `${awayId}_club`, date: null, score, state: "" });
  const next = nextRivalFixture("a", [fixture("1", 1, "7778", "9", [4, 3]), fixture("3", 3, "7778", "11"), fixture("2", 2, "10", "7778")]);
  assert.deepEqual(next, { teamId: "a", fixtureId: "2", round: 2, date: null, rivalId: "10", rivalName: "10 club" });
  assert.equal(nextRivalFixture("b", [fixture("2", 2, "10", "7778")]), null);
});

test("al sitio oculto solo entran el entrenador y los capitanes", async () => {
  assert.equal(await canPrepareRivals({ account: async () => ({ id: "coach", role: "coach" }), teams: async () => ["a", "b"] }), true);
  assert.equal(await canPrepareRivals({ account: async () => ({ id: "c", role: "player" }), teams: async () => ["b"] }), true);
  assert.equal(await canPrepareRivals({ account: async () => ({ id: "p", role: "player" }), teams: async () => [] }), false);
  assert.equal(await canPrepareRivals({ account: async () => ({ id: "v", role: "visitor" }), teams: async () => ["a"] }), false);
  assert.equal(await canPrepareRivals({ account: async () => null, teams: async () => ["a"] }), false);
  assert.equal(await canPrepareRivals({ account: async () => { throw new Error("caído"); }, teams: async () => ["a"] }), false);
});

test("la alineación del rival se conserva por equipo y jornada hasta que se borra", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fito-rival-"));
  const previous = process.env.RIVAL_LINEUPS_FILE;
  process.env.RIVAL_LINEUPS_FILE = path.join(directory, "rival.json");
  try {
    assert.equal(await readRivalLineup("a", "50"), null);
    await saveRivalLineup({ team_id: "a", fixture_id: "50", rival_id: "9", pairs: lineup("1", "2") });
    await saveRivalLineup({ team_id: "b", fixture_id: "60", rival_id: "8", pairs: lineup("5") });
    await saveRivalLineup({ team_id: "a", fixture_id: "50", rival_id: "9", pairs: lineup("3", "4") });
    assert.deepEqual((await readRivalLineup("a", "50"))?.pairs[0].players, ["3", "4"]);
    assert.equal((await readRivalLineup("b", "60"))?.rival_id, "8");
    await clearRivalLineup("a", "50");
    assert.equal(await readRivalLineup("a", "50"), null);
    assert.ok(await readRivalLineup("b", "60"));
  } finally {
    if (previous === undefined) delete process.env.RIVAL_LINEUPS_FILE;
    else process.env.RIVAL_LINEUPS_FILE = previous;
    await rm(directory, { recursive: true });
  }
});

test("la API del rival rechaza otro origen, cuerpos grandes y datos no válidos antes de leer la sesión", async () => {
  const { POST } = await import("../src/app/api/rival-lineups/route");
  const request = (origin: string, body: string) => new Request("http://localhost/api/rival-lineups", { method: "POST", headers: { origin, host: "localhost", "Content-Type": "application/json" }, body });
  assert.equal((await POST(request("http://example.com", JSON.stringify({ teamId: "a", action: "save" })))).status, 403);
  assert.equal((await POST(request("http://localhost", "x".repeat(17000)))).status, 413);
  assert.equal((await POST(request("http://localhost", JSON.stringify({ teamId: "c", action: "save" })))).status, 400);
  assert.equal((await POST(request("http://localhost", JSON.stringify({ teamId: "a", action: "borrar" })))).status, 400);
  assert.equal((await POST(request("http://localhost", "{"))).status, 400);
});

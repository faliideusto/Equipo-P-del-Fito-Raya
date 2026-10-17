import test from "node:test";
import assert from "node:assert/strict";
import type { SnpFixture } from "../src/domain/snp";
import { rivalPreparations } from "../src/lib/rival-preparation";

const fixture = (id: string, round: number, homeId: string, awayId: string, score: [number, number] | null = null): SnpFixture =>
  ({ id, round, homeId, awayId, homeName: homeId, awayName: awayId, date: "2026-10-25T10:00:00Z", score, state: "" });
const calendar = [
  fixture("4", 4, "7778", "later"),
  fixture("1", 1, "7778", "played", [7, 5]),
  fixture("3", 3, "next-a", "7778"),
  fixture("2", 2, "next-b", "803902"),
  fixture("5", 1, "unrelated", "other"),
];
const account = async () => ({ id: "coach", role: "coach" as const });

test("el entrenador puede preparar el próximo rival del A y el del B, local o visitante", async () => {
  const deps = { account, teams: async () => ["a", "b"] as ("a" | "b")[], calendar: async () => calendar };
  assert.deepEqual(await rivalPreparations("next-a", deps), [{ teamId: "a", fixtureId: "3", round: 3, date: "2026-10-25T10:00:00Z" }]);
  assert.equal((await rivalPreparations("next-b", deps))[0].teamId, "b");
  assert.deepEqual(await rivalPreparations("later", deps), []);
  assert.deepEqual(await rivalPreparations("played", deps), []);
  assert.deepEqual(await rivalPreparations("other", deps), []);
  assert.equal((await rivalPreparations("next-a", { ...deps, calendar: async () => [fixture("3", 3, "7778", "next-a")] }))[0].fixtureId, "3");
});

test("cualquier capitán puede preparar el siguiente rival tanto del A como del B", async () => {
  const deps = { account: async () => ({ id: "captain-b", role: "player" as const }), teams: async () => ["b"] as "b"[], calendar: async () => calendar };
  assert.equal((await rivalPreparations("next-b", deps)).length, 1);
  assert.equal((await rivalPreparations("next-a", deps))[0].teamId, "a");
  assert.deepEqual(await rivalPreparations("later", deps), []);
});

test("sin sesión, visitante o jugador sin capitanía no se consulta el calendario ni se ofrece el creador", async () => {
  const unexpected = async (): Promise<SnpFixture[]> => { assert.fail("no debe consultar SNP"); };
  const noTeams = async () => [];
  assert.deepEqual(await rivalPreparations("next-a", { account: async () => null, teams: noTeams, calendar: unexpected }), []);
  assert.deepEqual(await rivalPreparations("next-a", { account: async () => ({ id: "visitor", role: "visitor" }), teams: noTeams, calendar: unexpected }), []);
  assert.deepEqual(await rivalPreparations("next-a", { account: async () => ({ id: "player", role: "player" }), teams: noTeams, calendar: unexpected }), []);
});

test("sin jornadas pendientes o al fallar permisos o datos, el creador permanece oculto", async () => {
  const deps = { account, teams: async () => ["a"] as "a"[], calendar: async () => [] };
  assert.deepEqual(await rivalPreparations("next-a", deps), []);
  assert.deepEqual(await rivalPreparations("next-a", { ...deps, calendar: async () => [fixture("3", 3, "next-a", "7778", [6, 6])] }), []);
  assert.deepEqual(await rivalPreparations("next-a", { ...deps, calendar: async () => { throw new Error("SNP caído"); } }), []);
  assert.deepEqual(await rivalPreparations("next-a", { ...deps, teams: async () => { throw new Error("Supabase caído"); } }), []);
  assert.deepEqual(await rivalPreparations("next-a", { ...deps, account: async () => { throw new Error("Sesión no comprobada"); } }), []);
});

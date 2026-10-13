import test from "node:test";
import assert from "node:assert/strict";
import { chatIdentity } from "../src/lib/chat/identity";
import type { Player } from "../src/domain/types";

const ana: Player = { id: "b-77", sourceId: "77", name: "Ana Pérez", teamId: "b", points: 10, position: null };
const deps = (teams: ("a" | "b")[], linked = true) => ({ link: async () => linked ? { player_id: "77" } : null, teams: async () => teams, players: async () => [ana] });

test("el equipo por defecto es el del jugador; compartido, sin ficha o entrenador → ambos", async () => {
  assert.deepEqual(await chatIdentity({ id: "u", role: "player" }, deps(["b"])), { label: "Ana Pérez, jugador del club", team: "b" });
  assert.equal((await chatIdentity({ id: "u", role: "player" }, deps(["a", "b"]))).team, null);
  assert.deepEqual(await chatIdentity({ id: "u", role: "player" }, deps([], false)), { label: "un jugador del club", team: null });
  assert.deepEqual(await chatIdentity({ id: "coach", role: "coach" }, deps(["a"])), { label: "el entrenador del club", team: null });
});

test("si falla la consulta de la ficha, el chat sigue con valores neutros", async () => {
  const broken = { ...deps(["a"]), link: async () => { throw new Error("Supabase caído"); } };
  assert.deepEqual(await chatIdentity({ id: "u", role: "player" }, broken), { label: "un jugador del club", team: null });
});

import test from "node:test";
import assert from "node:assert/strict";
import { runTool, toolsFor, type ChatData } from "../src/lib/chat/tools";
import type { Fixture, Player } from "../src/domain/types";

const player = (id: string, name: string, teamId: "a" | "b", extra: Partial<Player> = {}): Player => ({ id, name, teamId, points: 100, position: "RIGHT", sourceId: id, ...extra });
const fixture = (round: number, extra: Partial<Fixture> = {}): Fixture => ({ id: String(5000 + round), teamId: "a", round, opponent: `Rival ${round}`, date: `2026-10-${10 + round}T10:00`, venue: "", home: true, status: "pending", matches: [], score: null, ...extra });
const players = { a: [player("1", "Ana Pérez", "a"), player("2", "Luis Gómez", "a", { position: "LEFT" }), player("3", "Marta Ruiz", "a")], b: [player("1", "Ana Pérez", "a"), player("4", "Pablo Pérez", "b", { position: null })] };
let calls: string[] = [];
const data: ChatData = {
  players: async t => { calls.push(`players:${t}`); return players[t]; },
  fixtures: async () => [fixture(1, { status: "played", score: [1, 4], home: false }), fixture(2), fixture(3)],
  standings: async () => [{ name: "Club X", played: 2, won: 2, lost: 0, points: 6 }, { teamId: "7778", name: "Fito Raya", played: 2, won: 1, lost: 1, points: 4, own: true }],
  ranking: async () => [{ player: players.a[0], played: 2, won: 2, lost: 0, points: 8 }],
  match: async () => ({ id: "5001", title: "", dateLabel: "", teams: ["Rival 1", "Fito Raya"], score: [1, 4], games: [{ index: 0, homePlayers: ["R1", "R2"], awayPlayers: ["Ana Pérez", "Luis Gómez"], sets: [[3, 6], [4, 6]] }] }),
  winRate: async () => ({ won: 3, lost: 1, decided: 4, percentage: 75 }),
  availability: async (_t, id) => id === "5002" ? ["1", "3"] : null,
  lineups: async () => [{ id: "x", team_id: "a", name: "Base", pairs: [{ id: "p1", players: ["1", "2"] }], created_at: "2026-10-01" }],
};
const run = async (name: string, args: unknown, role: "player" | "coach" = "player") => JSON.parse(await runTool(name, args, role, data));

test("un jugador no recibe ni puede ejecutar las herramientas del entrenador", async () => {
  const names = (role: "player" | "coach") => toolsFor(role).map(t => t.function.name);
  assert.deepEqual(names("player"), ["calendario", "clasificacion", "ranking_temporada", "acta", "jugador"]);
  assert.deepEqual(names("coach"), [...names("player"), "disponibilidad", "posiciones_y_parejas"]);
  calls = [];
  assert.match((await run("disponibilidad", { equipo: "a" })).error, /no disponible/);
  assert.match((await run("posiciones_y_parejas", { equipo: "a" })).error, /no disponible/);
  assert.match((await run("borrar_todo", {})).error, /no disponible/);
  assert.deepEqual(calls, []);
});

test("argumentos inválidos devuelven un error legible al modelo", async () => {
  assert.match((await run("calendario", { equipo: "c" })).error, /equipo/);
  assert.match((await run("acta", { equipo: "a", jornada: "tres" })).error, /jornada/);
  assert.match((await run("calendario", null)).error, /equipo/);
  assert.match((await run("jugador", { nombre: "a" })).error, /nombre/);
});

test("calendario y clasificación salen desde el punto de vista del club", async () => {
  const cal = await run("calendario", { equipo: "a" });
  assert.deepEqual(cal[0], { jornada: 1, rival: "Rival 1", fecha: "2026-10-11T10:00", campo: "fuera", estado: "jugado", resultado: "4-1 (club-rival)" });
  assert.equal(cal[1].resultado, null);
  const tabla = await run("clasificacion", { equipo: "a" });
  assert.deepEqual(tabla[1], { posicion: 2, equipo: "Fito Raya", jugados: 2, ganados: 1, perdidos: 1, puntos: 4, es_nuestro: true });
  assert.deepEqual((await run("ranking_temporada", { equipo: "a" })).jugadores, [{ posicion: 1, jugador: "Ana Pérez", jugados: 2, ganados: 2, perdidos: 0, puntos: 8, porcentaje_victorias: 100 }]);
});

test("acta: parejas con nuestro lado primero; jornada pendiente o inexistente", async () => {
  const acta = await run("acta", { equipo: "a", jornada: 1 });
  assert.deepEqual(acta.parejas[0], { pareja: 1, nuestros: "Ana Pérez / Luis Gómez", rivales: "R1 / R2", sets: "6-3, 6-4", ganada: true });
  assert.equal((await run("acta", { equipo: "a", jornada: 2 })).estado, "pendiente");
  assert.match((await run("acta", { equipo: "a", jornada: 9 })).error, /jornada 9/);
});

test("jugador: sin tildes ni mayúsculas, sin duplicados entre equipos", async () => {
  const r = await run("jugador", { nombre: "perez" });
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { jugador: "Ana Pérez", equipos: ["A", "B"], puntos: 100, posicion: "derecha", partidos_temporada: { ganados: 3, perdidos: 1, porcentaje: 75 } });
  assert.equal(r[1].posicion, "sin indicar");
  assert.deepEqual(await run("jugador", { nombre: "zzz" }), { encontrados: 0 });
});

test("disponibilidad: próxima jornada pendiente por defecto y aviso si no hay lista", async () => {
  const d = await run("disponibilidad", { equipo: "a" }, "coach");
  assert.deepEqual(d, { jornada: 2, rival: "Rival 2", fecha: "2026-10-12T10:00", disponibles: ["Ana Pérez", "Marta Ruiz"], no_disponibles: ["Luis Gómez"] });
  const sin = await run("disponibilidad", { equipo: "a", jornada: 3 }, "coach");
  assert.equal(sin.guardada, false);
});

test("posiciones y parejas guardadas para el entrenador", async () => {
  const p = await run("posiciones_y_parejas", { equipo: "a" }, "coach");
  assert.deepEqual(p.jugadores[1], { jugador: "Luis Gómez", posicion: "revés", puntos: 100 });
  assert.deepEqual(p.alineaciones_guardadas, [{ nombre: "Base", parejas: ["1: Ana Pérez / Luis Gómez"] }]);
});

test("un fallo de datos o un resultado enorme no rompen la conversación", async () => {
  const failing: ChatData = { ...data, standings: async () => { throw new Error("SNP caído"); }, ranking: async () => Array.from({ length: 500 }, () => ({ player: players.a[0], played: 1, won: 1, lost: 0, points: 1 })) };
  assert.match(JSON.parse(await runTool("clasificacion", { equipo: "a" }, "player", failing)).error, /No se pudieron consultar/);
  const big = await runTool("ranking_temporada", { equipo: "a" }, "player", failing);
  assert.ok(big.length <= 6020);
  assert.ok(big.endsWith("…(recortado)"));
});

test("las fechas de SNP en UTC se dan en hora de Madrid", async () => {
  const utc: ChatData = { ...data, fixtures: async () => [fixture(1, { date: "2026-10-17T08:00:00.000Z" })] };
  const cal = JSON.parse(await runTool("calendario", { equipo: "a" }, "player", utc));
  assert.equal(cal[0].fecha, "sábado, 17 de octubre de 2026, 10:00");
  const sin = JSON.parse(await runTool("calendario", { equipo: "a" }, "player", { ...data, fixtures: async () => [fixture(1, { date: "" })] }));
  assert.equal(sin[0].fecha, "sin fecha");
});

test("ranking: porcentaje de victorias calculado y todos los empatados en el mejor porcentaje", async () => {
  const row = (name: string, won: number, lost: number, points: number) => ({ player: player(name, name, "a"), played: won + lost, won, lost, points });
  const ranked: ChatData = { ...data, ranking: async () => [row("Ana", 2, 0, 9), row("Luis", 3, 1, 8), row("Marta", 1, 0, 3), row("Pablo", 2, 0, 6), row("Sin jugar", 0, 0, 0)] };
  const r = JSON.parse(await runTool("ranking_temporada", { equipo: "a" }, "player", ranked));
  assert.equal(r.jugadores[1].porcentaje_victorias, 75);
  assert.equal(r.jugadores[4].porcentaje_victorias, null);
  assert.deepEqual(r.mejor_porcentaje, { porcentaje: 100, empatados: ["Ana (2-0)", "Pablo (2-0)", "Marta (1-0)"] });
});

test("ranking sin equipo: los dos equipos y el mejor porcentaje de todo el club", async () => {
  const row = (name: string, team: "a" | "b", won: number, lost: number) => ({ player: player(name, name, team), played: won + lost, won, lost, points: won });
  const both: ChatData = { ...data, ranking: async t => t === "a" ? [row("Ana", "a", 2, 0), row("Luis", "a", 1, 1)] : [row("Pablo", "b", 1, 0), row("Ana", "b", 2, 0)] };
  const r = JSON.parse(await runTool("ranking_temporada", {}, "player", both));
  assert.equal(r.equipo_a.jugadores.length, 2);
  assert.equal(r.equipo_b.jugadores.length, 2);
  assert.deepEqual(r.mejor_porcentaje_club, { porcentaje: 100, empatados: ["Ana (A, 2-0)", "Ana (B, 2-0)", "Pablo (B, 1-0)"] });
  assert.match((await run("ranking_temporada", { equipo: "c" })).error, /equipo/);
  assert.deepEqual((toolsFor("player").find(t => t.function.name === "ranking_temporada")!.function.parameters as { required: string[] }).required, []);
});

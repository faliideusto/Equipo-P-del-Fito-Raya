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
  assert.ok((await run("calendario", null)).equipo_a, "sin argumentos devuelve los dos equipos");
  assert.match((await run("jugador", { nombre: "a" })).error, /nombre/);
});

test("calendario y clasificación salen desde el punto de vista del club", async () => {
  const cal = (await run("calendario", { equipo: "a" })).jornadas;
  assert.deepEqual(cal[0], { jornada: 1, vuelta: 1, rival: "Rival 1", fecha: "2026-10-11T10:00", campo: "fuera", estado: "jugado", resultado: "4-1 (club-rival)" });
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
  assert.deepEqual(d, { equipo: "A", jornada: 2, rival: "Rival 2", fecha: "2026-10-12T10:00", disponibles: ["Ana Pérez", "Marta Ruiz"], no_disponibles: ["Luis Gómez"] });
  const sin = await run("disponibilidad", { equipo: "a", jornada: 3 }, "coach");
  assert.equal(sin.guardada, false);
  assert.match(sin.nota, /^Equipo A: /);
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
  assert.ok(big.length <= 9020);
  assert.ok(big.endsWith("…(recortado)"));
});

test("las fechas de SNP en UTC se dan en hora de Madrid", async () => {
  const utc: ChatData = { ...data, fixtures: async () => [fixture(1, { date: "2026-10-17T08:00:00.000Z" })] };
  const cal = JSON.parse(await runTool("calendario", { equipo: "a" }, "player", utc)).jornadas;
  assert.equal(cal[0].fecha, "sábado, 17 de octubre de 2026, 10:00");
  const sin = JSON.parse(await runTool("calendario", { equipo: "a" }, "player", { ...data, fixtures: async () => [fixture(1, { date: "" })] })).jornadas;
  assert.equal(sin[0].fecha, "sin fecha");
});

test("ranking: porcentaje de victorias calculado y todos los empatados en el mejor porcentaje", async () => {
  const row = (name: string, won: number, lost: number, points: number) => ({ player: player(name, name, "a"), played: won + lost, won, lost, points });
  const ranked: ChatData = { ...data, ranking: async () => [row("Ana", 2, 0, 9), row("Luis", 3, 1, 8), row("Marta", 1, 0, 3), row("Pablo", 2, 0, 6), row("Sin jugar", 0, 0, 0)] };
  const r = JSON.parse(await runTool("ranking_temporada", { equipo: "a" }, "player", ranked));
  assert.equal(r.jugadores[1].porcentaje_victorias, 75);
  assert.equal(r.jugadores[4].porcentaje_victorias, null);
  assert.deepEqual(r.mejor_porcentaje, { porcentaje: 100, empatados: ["Ana (2-0)", "Pablo (2-0)", "Marta (1-0)"], texto: "Equipo A: 3 jugadores empatados al 100%: Ana (2-0), Pablo (2-0) y Marta (1-0)." });
  assert.deepEqual(r.peor_porcentaje, { porcentaje: 75, empatados: ["Luis (3-1)"], texto: "Equipo A: Luis (3-1) tiene el porcentaje más bajo: 75%." });
});

test("ranking sin equipo: los dos equipos y el mejor porcentaje de todo el club", async () => {
  const row = (name: string, team: "a" | "b", won: number, lost: number) => ({ player: player(name, name, team), played: won + lost, won, lost, points: won });
  const both: ChatData = { ...data, ranking: async t => t === "a" ? [row("Ana", "a", 2, 0), row("Luis", "a", 1, 1)] : [row("Pablo", "b", 1, 0), row("Ana", "b", 2, 0)] };
  const r = JSON.parse(await runTool("ranking_temporada", {}, "player", both));
  assert.equal(r.equipo_a.jugadores.length, 2);
  assert.equal(r.equipo_b.jugadores.length, 2);
  assert.deepEqual(r.mejor_porcentaje_club, { porcentaje: 100, empatados: ["Ana (A, 2-0)", "Ana (B, 2-0)", "Pablo (B, 1-0)"], texto: "3 jugadores empatados al 100%: Ana (A, 2-0), Ana (B, 2-0) y Pablo (B, 1-0)." });
  assert.equal(r.peor_porcentaje_club.texto, "Luis (A, 1-1) tiene el porcentaje más bajo: 50%.");
  assert.match((await run("ranking_temporada", { equipo: "c" })).error, /equipo/);
  assert.deepEqual((toolsFor("player").find(t => t.function.name === "ranking_temporada")!.function.parameters as { required: string[] }).required, []);
});

test("calendario: cada jornada dice de qué vuelta es, también con jornadas de descanso", async () => {
  const liga: ChatData = { ...data, fixtures: async () => [2, 3, 4, 5, 7, 8, 9, 10].map(r => fixture(r)) };
  const cal = JSON.parse(await runTool("calendario", { equipo: "b" }, "player", liga)).jornadas;
  assert.deepEqual(cal.map((f: { jornada: number; vuelta: number }) => [f.jornada, f.vuelta]), [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2]]);
});

test("acta da el lugar: en casa, o la sede de SNP fuera aunque no se haya jugado", async () => {
  const venues: ChatData = { ...data, fixtures: async () => [fixture(1, { home: true }), fixture(2, { home: false }), fixture(3, { home: false })], match: async id => ({ id, title: "", dateLabel: "", teams: ["X", "Y"], score: null, games: [], venue: id === "5002" ? "PADEL CLUB TRES CAMINOS" : null }) };
  const run2 = async (j: number) => JSON.parse(await runTool("acta", { equipo: "a", jornada: j }, "player", venues));
  assert.equal((await run2(1)).lugar, "en casa");
  assert.deepEqual(await run2(2), { jornada: 2, rival: "Rival 2", fecha: "2026-10-12T10:00", estado: "pendiente", lugar: "PADEL CLUB TRES CAMINOS" });
  assert.equal((await run2(3)).lugar, "fuera, sede sin publicar en SNP");
  const down: ChatData = { ...venues, match: async () => { throw new Error("SNP caído"); } };
  assert.equal(JSON.parse(await runTool("acta", { equipo: "a", jornada: 2 }, "player", down)).lugar, "fuera, sede sin publicar en SNP");
});

test("calendario: jornadas destacadas ya resueltas, con lugar, y los dos equipos si no se dice cuál", async () => {
  const liga: ChatData = {
    ...data,
    fixtures: async t => t === "a"
      ? [fixture(1, { status: "played", score: [3, 2] }), fixture(2, { home: false }), fixture(3), fixture(4, { home: false })]
      : [fixture(2, { teamId: "b" }), fixture(4, { teamId: "b", home: false })],
    match: async id => ({ id, title: "", dateLabel: "", teams: ["X", "Y"], score: null, games: [], venue: id === "5002" ? "PADEL CLUB TRES CAMINOS" : null }),
  };
  const a = JSON.parse(await runTool("calendario", { equipo: "a" }, "player", liga));
  assert.deepEqual(a.destacadas.ultima_de_primera_vuelta, { jornada: 2, estado: "pendiente", rival: "Rival 2", dia: "2026-10-12T10:00", hora: null, campo: "fuera", lugar: "PADEL CLUB TRES CAMINOS", resumen: "Equipo A · Última jornada de la primera vuelta · Jornada 2 (pendiente): se juega el 2026-10-12T10:00, fuera contra Rival 2, en PADEL CLUB TRES CAMINOS." });
  assert.equal(a.destacadas.jugada_mas_reciente.estado, "jugado");
  assert.equal(a.destacadas.primera_de_segunda_vuelta.jornada, 3);
  assert.equal(a.destacadas.primera_de_segunda_vuelta.lugar, "en casa");
  assert.equal(a.destacadas.proxima.jornada, 2);
  assert.equal(a.destacadas.jugada_mas_reciente.jornada, 1);
  const both = JSON.parse(await runTool("calendario", {}, "player", liga));
  assert.equal(both.equipo_a.destacadas.ultima_de_primera_vuelta.jornada, 2);
  assert.equal(both.equipo_b.destacadas.ultima_de_primera_vuelta.jornada, 2);
  assert.equal(both.equipo_b.destacadas.jugada_mas_reciente, null);
  assert.match(both.equipo_b.destacadas.ultima_de_primera_vuelta.resumen, /^Equipo B · Última jornada de la primera vuelta · Jornada 2/);
  assert.deepEqual((toolsFor("player").find(t => t.function.name === "calendario")!.function.parameters as { required: string[] }).required, []);
});

test("destacadas: día y hora por separado en hora de Madrid", async () => {
  const utc: ChatData = { ...data, fixtures: async () => [fixture(5, { date: "2026-11-08T16:00:00.000Z", home: true })] };
  const d = JSON.parse(await runTool("calendario", { equipo: "a" }, "player", utc)).destacadas.proxima;
  assert.equal(d.dia, "domingo, 8 de noviembre de 2026");
  assert.equal(d.hora, "17:00");
  assert.equal(d.resumen, "Equipo A · Próxima jornada · Jornada 5 (pendiente): se juega el domingo, 8 de noviembre de 2026 a las 17:00, en casa contra Rival 5.");
});

test("un único mejor porcentaje no habla de empate", async () => {
  const one: ChatData = { ...data, ranking: async () => [{ player: player("x", "Ana", "a"), played: 3, won: 3, lost: 0, points: 9 }, { player: player("y", "Luis", "a"), played: 2, won: 1, lost: 1, points: 3 }] };
  assert.equal(JSON.parse(await runTool("ranking_temporada", { equipo: "a" }, "player", one)).mejor_porcentaje.texto, "Equipo A: Ana (3-0) tiene el mejor porcentaje: 100%.");
});

test("empatados en el porcentaje más bajo", async () => {
  const row = (name: string, won: number, lost: number) => ({ player: player(name, name, "a"), played: won + lost, won, lost, points: won });
  const tied: ChatData = { ...data, ranking: async () => [row("Ana", 2, 0), row("Luis", 1, 3), row("Marta", 0, 2), row("Pablo", 0, 1)] };
  assert.equal(JSON.parse(await runTool("ranking_temporada", { equipo: "a" }, "player", tied)).peor_porcentaje.texto, "Equipo A: 2 jugadores empatados en el porcentaje más bajo, 0%: Marta (0-2) y Pablo (0-1).");
});

test("el equipo del selector rellena el que el modelo no indica, pero no pisa el que sí indica", async () => {
  const withTeam = async (args: object, team: "a" | "b" | null) => JSON.parse(await runTool("calendario", args, "player", data, team));
  assert.ok((await withTeam({}, "a")).destacadas, "con selector A devuelve solo el A");
  assert.equal((await withTeam({}, "a")).equipo_a, undefined);
  assert.ok((await withTeam({}, null)).equipo_a, "con Ambos devuelve los dos");
  assert.match(JSON.parse(await runTool("acta", { jornada: 1 }, "player", data, "a")).parejas[0].nuestros, /Ana Pérez/);
  const explicit = JSON.parse(await runTool("ranking_temporada", { equipo: "b" }, "player", { ...data, ranking: async t => t === "b" ? [{ player: player("9", "Solo B", "b"), played: 1, won: 1, lost: 0, points: 2 }] : [] }, "a"));
  assert.equal(explicit.jugadores[0].jugador, "Solo B");
});

test("calendario: balance de encuentros ya contado, con empates y jornadas pendientes", async () => {
  const liga: ChatData = { ...data, fixtures: async () => [fixture(1, { status: "played", score: [6, 6] }), fixture(2, { status: "played", score: [10, 2] }), fixture(3, { status: "played", score: [9, 3], home: false }), fixture(4), fixture(5)] };
  const cal = JSON.parse(await runTool("calendario", { equipo: "a" }, "player", liga));
  assert.deepEqual(cal.balance, { jugados: 3, ganados: 1, empatados: 1, perdidos: 1, pendientes: 2, texto: "Equipo A: 3 encuentros jugados (1 ganado, 1 empatado y 1 perdido) y 2 pendientes." });
});

test("calendario: la última jugada trae el resultado; las de descanso se nombran y el acta lo explica", async () => {
  const liga: ChatData = { ...data, fixtures: async () => [2, 3, 4, 5, 7, 8].map(r => fixture(r, r === 2 ? { status: "played", score: [5, 7] } : {})) };
  const cal = JSON.parse(await runTool("calendario", { equipo: "b" }, "player", liga));
  assert.equal(cal.destacadas.jugada_mas_reciente.resultado, "5-7 (club-rival)");
  assert.match(cal.destacadas.jugada_mas_reciente.resumen, /\(jugada\): se jugó el .*resultado 5-7 \(club-rival\)\.$/);
  assert.equal(cal.destacadas.ultima_jugada, undefined, "sin ultima_jugada: el modelo la confunde con ultima_de_primera_vuelta");
  assert.deepEqual(cal.jornadas.filter((j: { estado: string }) => j.estado === "descanso").map((j: { jornada: number }) => j.jornada), [1, 6]);
  assert.deepEqual(cal.jornadas[0], { jornada: 1, vuelta: 1, estado: "descanso", nota: "El equipo B descansa: no tiene partido en la jornada 1." });
  assert.match(JSON.parse(await runTool("acta", { equipo: "b", jornada: 1 }, "player", liga)).error, /descansa en la jornada 1/);
  assert.match(JSON.parse(await runTool("acta", { equipo: "b", jornada: 9 }, "player", liga)).error, /no existe la jornada 9/);
});

test("acta sin jornada da la última jugada, para preguntas como quién jugó", async () => {
  const acta = await run("acta", { equipo: "a" });
  assert.equal(acta.jornada, 1);
  assert.equal(acta.parejas[0].nuestros, "Ana Pérez / Luis Gómez");
  assert.match((await runTool("acta", { equipo: "a" }, "player", { ...data, fixtures: async () => [fixture(1)] })), /todavía no se ha jugado ninguna jornada/);
});

test("el calendario de los dos equipos de una liga de 10 jornadas llega entero", async () => {
  const long = "CENTRO MÉDICO MONTEALTO - JACARANDA";
  const liga: ChatData = { ...data, fixtures: async () => Array.from({ length: 10 }, (_, i) => fixture(i + 1, { opponent: long, date: "2026-11-08T16:00:00.000Z", home: i % 2 === 0, ...(i < 3 ? { status: "played", score: [6, 6] } : {}) })), match: async id => ({ id, title: "", dateLabel: "", teams: ["X", "Y"], score: null, games: [], venue: "PADEL CUBIERTO ARCOS SL" }) };
  const text = await runTool("calendario", {}, "player", liga);
  assert.ok(!text.endsWith("…(recortado)"), `recortado con ${text.length} caracteres`);
});

test("destacadas: la siguiente a la próxima, y quién jugó en la última jugada", async () => {
  const cal = JSON.parse(await runTool("calendario", { equipo: "a" }, "player", data));
  assert.equal(cal.destacadas.siguiente_a_la_proxima.jornada, 3);
  assert.deepEqual(cal.destacadas.jugada_mas_reciente.parejas, ["Pareja 1: Ana Pérez / Luis Gómez contra R1 / R2, 6-3, 6-4 (ganada)"]);
  assert.equal(cal.destacadas.proxima.parejas, undefined);
});

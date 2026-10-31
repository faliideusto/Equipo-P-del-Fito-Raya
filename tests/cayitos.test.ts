import test from "node:test";
import assert from "node:assert/strict";
import { canOpenCayitos, cayitoMembers, cayitoStats, crowns, sameName, sortCayitos, streaks } from "../src/domain/cayitos";
import { canSeeCayitos } from "../src/lib/cayitos";
import type { SnpPlayerProfile } from "../src/domain/snp";

test("solo Rafael, Hugo y Dionisio pueden abrir el ranking cayitos", async () => {
  assert.ok(canOpenCayitos("381423") && canOpenCayitos("397865") && canOpenCayitos("381480"));
  assert.ok(!canOpenCayitos("376502") && !canOpenCayitos(null) && !canOpenCayitos(undefined));
  const link = async () => ({ player_id: "381423" });
  assert.equal(await canSeeCayitos({ account: async () => ({ id: "u", role: "player" }), link }), true);
  assert.equal(await canSeeCayitos({ account: async () => ({ id: "coach", role: "coach" }), link }), false);
  assert.equal(await canSeeCayitos({ account: async () => ({ id: "v", role: "visitor" }), link }), false);
  assert.equal(await canSeeCayitos({ account: async () => null, link }), false);
  assert.equal(await canSeeCayitos({ account: async () => ({ id: "u", role: "player" }), link: async () => ({ player_id: "376502" }) }), false);
  assert.equal(await canSeeCayitos({ account: async () => { throw new Error("caído"); }, link }), false);
});

test("encuentra a Tomás por nombre aunque SNP cambie el orden o las tildes", () => {
  assert.ok(sameName("MARTINEZ SANCHEZ TOMAS JESUS", "tomas jesus martinez sanchez"));
  assert.ok(sameName(" Tomás Jesús Martínez Sánchez Future", "tomas jesus martinez sanchez"));
  assert.ok(!sameName("Tomás Martínez", "tomas jesus martinez sanchez"));
});

test("racha actual y mejor racha", () => {
  assert.deepEqual(streaks(["W", "W", "W", "L", "W", "W"]), { streak: { type: "W", count: 2 }, best: 3 });
  assert.deepEqual(streaks(["W", "L", "L"]), { streak: { type: "L", count: 2 }, best: 1 });
  assert.deepEqual(streaks([]), { streak: null, best: 0 });
});

const round = (label: string, won: number, lost: number, points: number) => ({ label, points, played: won + lost, won, lost });
const profile: SnpPlayerProfile = {
  id: "381423", name: "Rafael Deusto", points: 58007.81, photoUrl: null, nationalRank: "120", zoneRank: null, groups: [], group: "20",
  previousStats: [{ phase: "Anterior", played: 2, won: 1, lost: 1, setsWon: 3, setsLost: 2, jornadas: [round("J1", 1, 0, 40000), round("J2", 0, 1, 38000)] }],
  stats: [{ phase: "Actual", played: 2, won: 2, lost: 0, setsWon: 4, setsLost: 1, jornadas: [round("J1", 1, 0, 50000), round("J2", 1, 0, 57000)] }],
  winRates: { current: { won: 2, lost: 0, decided: 2, percentage: 100, setsWon: 4, setsLost: 1 }, total: { won: 5, lost: 1, decided: 6, percentage: 5 / 6 * 100, setsWon: 11, setsLost: 4 } },
};

test("estadísticas: winrate y sets totales de todos los grupos, temporada, racha y evolución", () => {
  const row = cayitoStats(cayitoMembers[0], profile);
  assert.equal(row.played, 6); assert.equal(row.won, 5); assert.equal(row.setsWon, 11); assert.equal(row.setsLost, 4);
  assert.deepEqual(row.season, { played: 2, won: 2, lost: 0, winRate: 100 });
  assert.deepEqual(row.streak, { type: "W", count: 2 }); assert.deepEqual(row.last, ["W", "L", "W", "W"]);
  assert.deepEqual(row.history, [50000, 57000]); assert.equal(row.trend, 7000); assert.equal(row.peak, 58007.81);
  // A stored winrate without sets falls back to the sets of the selected group.
  const old = cayitoStats(cayitoMembers[0], { ...profile, winRates: { current: { won: 2, lost: 0, decided: 2, percentage: 100 }, total: { won: 3, lost: 1, decided: 4, percentage: 75 } } });
  assert.equal(old.setsWon, 7); assert.equal(old.setsLost, 3);
  const missing = cayitoStats(cayitoMembers[3], null, "No se encontró su ficha en SNP.");
  assert.equal(missing.points, null); assert.equal(missing.error, "No se encontró su ficha en SNP.");
});

test("orden y coronas", () => {
  const a = cayitoStats(cayitoMembers[0], profile);
  const b = { ...cayitoStats(cayitoMembers[1], profile), points: 60000, winRate: 50, setsWon: 5, setsLost: 6 };
  assert.deepEqual(sortCayitos([a, b], "points").map(row => row.key), ["hugo", "rafael"]);
  assert.deepEqual(sortCayitos([a, b], "winRate").map(row => row.key), ["rafael", "hugo"]);
  assert.deepEqual(crowns([a, b]), { points: "hugo", winRate: "rafael", sets: "rafael", streak: null });
});

test("la cuenta cayito solo abre el ranking, el buscador SNP y sus recursos", async () => {
  const { cayitoAllowed } = await import("../src/domain/cayitos");
  for (const path of ["/ranking-cayitos", "/competicion", "/competicion/equipos/3343", "/competicion/jugadores/1", "/api/account", "/api/snp/players/1", "/jugadores/381423.png", "/_next/data/x.json"]) assert.ok(cayitoAllowed(path), path);
  for (const path of ["/", "/equipos/a", "/equipos/a/sitio-oculto", "/mi-perfil", "/mvp", "/entrenador", "/api/results", "/api/account/stats", "/api/snp/sync", "/api/snp/connect", "/api/rival-lineups", "/asistente"]) assert.ok(!cayitoAllowed(path), path);
  assert.equal(await canSeeCayitos({ account: async () => ({ id: "t", role: "cayito" }), link: async () => null }), true);
});

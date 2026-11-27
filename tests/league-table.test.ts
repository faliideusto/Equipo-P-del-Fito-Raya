import test from "node:test";
import assert from "node:assert/strict";
import { nextFixture, nextRound, roundLabel, shortTeamName, signed, teamForm } from "../src/domain/league-table";
import type { SnpFixture } from "../src/domain/snp";

const fixture = (id: string, round: number, date: string | null, homeId: string, awayId: string, score: [number, number] | null): SnpFixture =>
  ({ id, round, date, homeId, awayId, homeName: `Team ${homeId}`, awayName: `Team ${awayId}`, score, state: score ? "closed" : "pending" });

test("la racha toma los 5 últimos jugados por fecha, con el marcador propio primero", () => {
  const fixtures = [
    fixture("1", 1, "2026-09-26", "fito", "x", [2, 10]),
    fixture("2", 2, "2026-10-03", "y", "fito", [2, 10]),
    fixture("3", 3, "2026-10-10", "fito", "z", [6, 6]),
    fixture("4", 4, "2026-10-17", "w", "fito", [9, 3]),
    fixture("5", 5, "2026-10-24", "fito", "v", [5, 7]),
    fixture("r", 1000, "2026-11-07", "fito", "u", [0, 12]),
    fixture("6", 6, "2026-11-28", "fito", "t", null),
    fixture("x", 1, "2026-09-26", "a", "b", [12, 0]),
  ];
  const form = teamForm("fito", fixtures);
  assert.deepEqual(form.map(f => f.fixtureId), ["2", "3", "4", "5", "r"]);
  assert.deepEqual(form.map(f => f.result), ["V", "E", "D", "D", "D"]);
  assert.deepEqual(form.map(f => `${f.own}-${f.rival}`), ["10-2", "6-6", "3-9", "5-7", "0-12"]);
});

test("la racha no cuenta dos veces un encuentro que aparece en dos divisiones", () => {
  const reto = fixture("r", 1000, "2026-11-07", "fito", "u", [7, 5]);
  assert.equal(teamForm("fito", [reto, { ...reto }]).length, 1);
});

test("sin fecha, la racha ordena por jornada con el reto entre las dos fases", () => {
  const form = teamForm("fito", [fixture("6", 6, null, "fito", "a", [12, 0]), fixture("r", 1000, null, "fito", "b", [0, 12]), fixture("5", 5, null, "fito", "c", [7, 5])]);
  assert.deepEqual(form.map(f => f.fixtureId), ["5", "r", "6"]);
});

test("el próximo es el encuentro del equipo en la primera jornada pendiente, o descansa", () => {
  const calendar = [
    fixture("5", 5, "2026-11-21", "a", "b", [7, 5]),
    fixture("6a", 6, "2026-11-28 10:00", "fito", "cr", null),
    fixture("6b", 6, "2026-11-28 12:00", "pg", "cm", null),
    fixture("7a", 7, "2026-12-05", "jc", "fito", null),
  ];
  assert.equal(nextRound(calendar), 6);
  assert.deepEqual(nextFixture("fito", calendar), { kind: "match", fixtureId: "6a", round: 6, date: "2026-11-28 10:00", home: true, rivalId: "cr", rivalName: "Team cr" });
  assert.equal(nextFixture("cm", calendar)?.kind, "match");
  assert.equal((nextFixture("cm", calendar) as { home: boolean }).home, false);
  assert.deepEqual(nextFixture("jc", calendar), { kind: "rest", round: 6, date: "2026-11-28 10:00" });
  assert.equal(nextFixture("fito", calendar.slice(0, 1)), null);
});

test("el reto pendiente va antes que la jornada 6", () => {
  assert.equal(nextRound([fixture("6", 6, null, "a", "b", null), fixture("r", 1000, null, "a", "c", null)]), 1000);
});

test("etiquetas de jornada, diferencia y nombres cortos", () => {
  assert.equal(roundLabel(6, "2026-11-28 10:00"), "J6 · 28 nov");
  assert.equal(roundLabel(1000, "2026-11-07"), "Reto · 7 nov");
  assert.equal(roundLabel(7, null), "J7");
  assert.equal(signed(6), "+6");
  assert.equal(signed(-18), "−18");
  assert.equal(signed(0), "0");
  assert.equal(shortTeamName("CRISTALERIA REINA"), "Cristalería");
  assert.equal(shortTeamName("ESCUELA FITO RAYA GAME B"), "Fito Raya B");
  assert.equal(shortTeamName("CENTRO MÉDICO MONTEALTO - JACARANDA"), "Montealto");
  assert.equal(shortTeamName("PÁDEL GASTRONOMICO MONTEPALMA"), "Montepalma");
  assert.equal(shortTeamName("JRPADEL C"), "Jrpadel C");
  assert.equal(shortTeamName("CD_PADEL_ARCOS"), "Arcos");
});

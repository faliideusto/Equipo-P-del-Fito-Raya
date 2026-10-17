import test from "node:test";
import assert from "node:assert/strict";
import type { SnpFixture } from "../src/domain/snp";
import { calendarMonths, fixtureDay, fixtureOutcome, initialMonth, monthGrid } from "../src/domain/schedule-calendar";

const fixture = (id: string, date: string | null, score: [number, number] | null = null, homeId = "7778"): SnpFixture =>
  ({ id, round: Number(id), date, homeId, awayId: homeId === "7778" ? "1" : "7778", homeName: "A", awayName: "B", score, state: "" });

test("toma la fecha de SNP tal cual, sin cambiar de zona horaria", () => {
  assert.equal(fixtureDay("2026-09-26T23:30"), "2026-09-26");
  assert.equal(fixtureDay("2026-09-26"), "2026-09-26");
  assert.equal(fixtureDay(""), null);
  assert.equal(fixtureDay(null), null);
});

test("incluye todos los meses entre el primer y el último encuentro", () => {
  assert.deepEqual(calendarMonths([fixture("1", "2026-11-08"), fixture("2", "2027-02-01"), fixture("3", null)]), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.deepEqual(calendarMonths([fixture("1", null)]), []);
});

test("abre en el próximo encuentro por jugar, o en el último si la temporada ha terminado", () => {
  const season = [fixture("1", "2026-09-26", [6, 6]), fixture("2", "2026-10-10", [3, 9]), fixture("3", "2026-11-07")];
  assert.equal(initialMonth(season, "2026-10-13"), "2026-11");
  assert.equal(initialMonth(season.slice(0, 2), "2026-10-13"), "2026-10");
  assert.equal(initialMonth([fixture("1", null)], "2026-10-13"), null);
});

test("semanas de lunes a domingo que cubren el mes entero", () => {
  const october = monthGrid("2026-10");
  assert.equal(october.length % 7, 0);
  assert.deepEqual(october[0], { key: "2026-09-28", day: 28, inMonth: false });
  assert.equal(october.filter(d => d.inMonth).length, 31);
  assert.equal(october[october.length - 1].key, "2026-11-01");
  const february = monthGrid("2027-02");
  assert.equal(february.length, 28);
  assert.equal(february[0].key, "2027-02-01");
});

test("lee el resultado desde nuestro lado, de local o de visitante", () => {
  assert.equal(fixtureOutcome(fixture("1", "2026-09-26", [9, 3]), "7778"), "win");
  assert.equal(fixtureOutcome(fixture("1", "2026-09-26", [9, 3], "1"), "7778"), "loss");
  assert.equal(fixtureOutcome(fixture("1", "2026-09-26", [6, 6]), "7778"), "draw");
  assert.equal(fixtureOutcome(fixture("1", "2026-09-26"), "7778"), "pending");
});

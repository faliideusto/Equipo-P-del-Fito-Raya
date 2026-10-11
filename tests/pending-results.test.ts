import test from "node:test";
import assert from "node:assert/strict";
import { fixtureStart, lastPlayedFixture, pendingFor, readActa, RESULT_DELAY_MS, type ReportState } from "../src/domain/pending-results";
import type { Fixture } from "../src/domain/types";
import type { SnpMatch } from "../src/domain/snp";

const fixture = (id: string, round: number, date: string, home = true): Fixture => ({ id, teamId: "a", round, opponent: "Arcos", date, venue: "", home, status: "pending", matches: [] });
const player = (id: string) => ({ id, name: id, photoUrl: null });
const acta = (games: { home: string[]; away: string[]; sets?: [number, number][] }[], teamIds: [string, string] = ["7778", "3349"]): SnpMatch => ({ id: "1", title: "", dateLabel: "", teams: ["Fito A", "Arcos"], teamIds, score: null, games: games.map((g, index) => ({ index, homePlayers: g.home, awayPlayers: g.away, home: g.home.map(player), away: g.away.map(player), sets: g.sets ?? [] })) });
const none: ReportState = { dismissedFixtureIds: new Set(), results: [] };

test("la última jornada exige dos horas desde el inicio", () => {
  const list = [fixture("1", 1, "2026-10-03T11:00:00.000Z"), fixture("2", 2, "2026-10-10T11:00:00.000Z"), fixture("3", 3, "2026-10-17T11:00:00.000Z")];
  const start = Date.parse("2026-10-10T11:00:00.000Z");
  assert.equal(lastPlayedFixture(list, start + RESULT_DELAY_MS - 1)?.id, "1");
  assert.equal(lastPlayedFixture(list, start + RESULT_DELAY_MS)?.id, "2");
  assert.equal(lastPlayedFixture(list, Date.parse("2026-09-01T00:00:00Z")), null);
  assert.equal(lastPlayedFixture([fixture("x", 1, "")], Date.now()), null);
});
test("una fecha sin hora no avisa hasta el día siguiente", () => {
  const start = fixtureStart("2026-10-10")!;
  assert.ok(start >= Date.parse("2026-10-10T23:00:00Z"));
  assert.equal(lastPlayedFixture([fixture("1", 1, "2026-10-10")], Date.parse("2026-10-10T20:00:00Z")), null);
  assert.equal(lastPlayedFixture([fixture("1", 1, "2026-10-10")], Date.parse("2026-10-11T09:00:00Z"))?.id, "1");
});
test("lee el acta desde el lado propio", () => {
  const convoked = acta([{ home: ["10", "11"], away: ["90", "91"] }, { home: ["12", "13"], away: ["92", "93"] }]);
  assert.deepEqual(readActa(convoked, false, "7778", true, "13"), { kind: "convoked", pair: 2 });
  assert.deepEqual(readActa(convoked, false, "7778", true, "99"), { kind: "absent" });
  assert.deepEqual(readActa(convoked, false, "7778", true, "92"), { kind: "absent" });
  const away = acta([{ home: ["90", "91"], away: ["10", "11"] }], ["3349", "7778"]);
  assert.deepEqual(readActa(away, false, "7778", false, "11"), { kind: "convoked", pair: 1 });
  const played = acta([{ home: ["10", "11"], away: ["90", "91"], sets: [[6, 2]] }]);
  assert.deepEqual(readActa(played, false, "7778", true, "10"), { kind: "published" });
});
test("sin alineación: pendiente libre si es SNP en vivo, nada si es caché o fallo", () => {
  const empty = acta([]);
  assert.deepEqual(readActa(empty, false, "7778", true, "10"), { kind: "no-lineup" });
  assert.deepEqual(readActa(empty, true, "7778", true, "10"), { kind: "unknown" });
  assert.deepEqual(readActa(null, false, "7778", true, "10"), { kind: "unknown" });
});
test("los datos de la app resuelven el pendiente", () => {
  const f = fixture("55", 7, "2026-10-10T11:00:00.000Z");
  const base = { teamId: "a" as const, fixture: f, userId: "u1" };
  assert.deepEqual(pendingFor({ ...base, acta: { kind: "convoked", pair: 3 }, reports: none }), { fixtureId: "55", teamId: "a", round: 7, date: f.date, opponent: "Arcos", home: true, pairLocked: 3 });
  assert.equal(pendingFor({ ...base, acta: { kind: "published" }, reports: none }), null);
  assert.equal(pendingFor({ ...base, acta: { kind: "absent" }, reports: none }), null);
  assert.equal(pendingFor({ ...base, acta: { kind: "unknown" }, reports: none }), null);
  assert.equal(pendingFor({ ...base, acta: { kind: "no-lineup" }, reports: { dismissedFixtureIds: new Set(["55"]), results: [] } }), null);
  const partner: ReportState = { dismissedFixtureIds: new Set(), results: [{ fixtureId: "55", teamId: "a", pairIndex: 3, submittedBy: "u2" }] };
  assert.equal(pendingFor({ ...base, acta: { kind: "convoked", pair: 3 }, reports: partner }), null);
  assert.equal(pendingFor({ ...base, acta: { kind: "convoked", pair: 2 }, reports: partner })?.pairLocked, 2);
  assert.equal(pendingFor({ ...base, acta: { kind: "no-lineup" }, reports: partner })?.pairLocked, null);
  const mine: ReportState = { dismissedFixtureIds: new Set(), results: [{ fixtureId: "55", teamId: "a", pairIndex: 1, submittedBy: "u1" }] };
  assert.equal(pendingFor({ ...base, acta: { kind: "no-lineup" }, reports: mine }), null);
});
test("jugador compartido: un resultado del equipo B no resuelve el A", () => {
  const f = fixture("55", 7, "2026-10-10T11:00:00.000Z");
  const otherTeam: ReportState = { dismissedFixtureIds: new Set(), results: [{ fixtureId: "55", teamId: "b", pairIndex: 1, submittedBy: "u1" }] };
  assert.ok(pendingFor({ teamId: "a", fixture: f, acta: { kind: "no-lineup" }, userId: "u1", reports: otherTeam }));
});
test("el aviso se consulta al entrar y como mucho cada cinco minutos al navegar", async () => {
  const { dueForCheck, PENDING_REFRESH_MS } = await import("../src/domain/pending-results");
  assert.equal(PENDING_REFRESH_MS, 5 * 60 * 1000);
  assert.equal(dueForCheck(null, 1000), true);
  assert.equal(dueForCheck(1000, 1000 + PENDING_REFRESH_MS - 1), false);
  assert.equal(dueForCheck(1000, 1000 + PENDING_REFRESH_MS), true);
});

import test from "node:test";
import assert from "node:assert/strict";
import { buildWalletCard, shortDate, walletNotice, type TeamCardContext } from "../src/domain/wallet-card";

const players = [
  { id: "a-1", sourceId: "1", name: "CARLOS MARTIN", position: "LEFT" as const, points: 20312.5 },
  { id: "a-2", sourceId: "2", name: "juan perez", position: "RIGHT" as const, points: 900 },
  { id: "b-3", sourceId: "3", name: "Ana Ruiz", position: null, points: null },
];
const next = { id: "50", round: 5, opponent: "C.D. VibraPadel", date: "2026-10-18T08:00:00.000Z", home: true };
const ctx = (over: Partial<TeamCardContext> = {}): TeamCardContext => ({ teamId: "a", players, next, published: { fixtureId: "50", pairs: [{ id: "p1", players: ["a-2", "b-3"] }, { id: "p2", players: ["a-1", "a-2"] }] }, last: { fixtureId: "40", round: 4, opponent: "Rival X", ours: 7, theirs: 5 }, ...over });

test("tarjeta completa de un jugador convocado", () => {
  assert.deepEqual(buildWalletCard(ctx(), "1"), {
    teamId: "a", playerSourceId: "1", teamLabel: "Equipo A", playerName: "Carlos Martin", playerLine: "Carlos Martin · Revés",
    next: { round: "J5", opponent: "C.D. VibraPadel", day: "Dom 18/10", time: "10:00", venue: "Local" }, nextMatch: "J5 · C.D. VibraPadel · Dom 18/10 10:00 · Local",
    lineup: "Convocado J5 · Pareja 2 con Juan Perez", lineupShort: "Pareja 2 con Juan Perez", lastResult: "J4 · Fito Raya A 7–5 Rival X",
    snpPoints: "20.313", teamPath: "/equipos/a/jornadas", actaPath: "/equipos/a/jornadas/40",
  });
});
test("convocatoria: sin compañero, no convocado, pendiente y sin partido", () => {
  const solo = ctx({ published: { fixtureId: "50", pairs: [{ id: "p1", players: ["a-1", null] }] } });
  assert.equal(buildWalletCard(solo, "1")!.lineup, "Convocado J5 · Pareja 1");
  assert.equal(buildWalletCard(ctx(), "3")!.lineup, "Convocado J5 · Pareja 1 con Juan Perez");
  assert.equal(buildWalletCard(ctx({ published: { fixtureId: "50", pairs: [{ id: "p1", players: ["a-2", null] }] } }), "1")!.lineup, "No convocado en J5");
  assert.equal(buildWalletCard(ctx({ published: null }), "1")!.lineup, "Convocatoria J5 pendiente");
  const none = buildWalletCard(ctx({ next: null, published: null }), "1")!;
  assert.equal(none.lineup, "Sin convocatoria");
  assert.equal(none.nextMatch, "Sin partidos programados");
});
test("una convocatoria de otra jornada no se muestra", () => {
  const stale = ctx({ next: { ...next, id: "60", round: 6 }, published: { fixtureId: "50", pairs: [{ id: "p1", players: ["a-1", "a-2"] }] } });
  assert.equal(buildWalletCard(stale, "1")!.lineup, "Convocatoria J6 pendiente");
});
test("fechas sin hora o vacías", () => {
  assert.equal(shortDate("2026-10-18"), "Dom 18/10");
  assert.equal(shortDate(""), null);
  assert.equal(shortDate("mañana"), null);
  assert.equal(buildWalletCard(ctx({ next: { ...next, date: "", home: false } }), "1")!.nextMatch, "J5 · C.D. VibraPadel · Fecha por confirmar · Visitante");
});
test("sin resultado, sin puntos, sin posición y jugador fuera de plantilla", () => {
  const card = buildWalletCard(ctx({ last: null }), "3")!;
  assert.equal(card.lastResult, "Sin resultados todavía");
  assert.equal(card.actaPath, null);
  assert.equal(card.snpPoints, "—");
  assert.equal(card.playerLine, "Ana Ruiz");
  assert.equal(buildWalletCard(ctx(), "999"), null);
});
test("avisos de convocatoria y resultado", () => {
  const card = buildWalletCard(ctx(), "1")!;
  assert.deepEqual(walletNotice(ctx(), card, "lineup"), { header: "Convocatoria J5", body: "Convocado J5 · Pareja 2 con Juan Perez" });
  assert.deepEqual(walletNotice(ctx(), card, "result"), { header: "Resultado J4", body: "J4 · Fito Raya A 7–5 Rival X" });
  assert.equal(walletNotice(ctx({ next: null }), card, "lineup"), null);
  assert.equal(walletNotice(ctx({ last: null }), card, "result"), null);
});
test("textos cortos para el frente de la tarjeta", () => {
  assert.equal(buildWalletCard(ctx(), "3")!.lineupShort, "Pareja 1 con Juan Perez");
  assert.equal(buildWalletCard(ctx({ published: { fixtureId: "50", pairs: [{ id: "p1", players: ["a-2", null] }] } }), "1")!.lineupShort, "No convocado");
  assert.equal(buildWalletCard(ctx({ published: null }), "1")!.lineupShort, "Pendiente");
  const none = buildWalletCard(ctx({ next: null, published: null }), "1")!;
  assert.equal(none.lineupShort, "Sin convocatoria");
  assert.equal(none.next, null);
  assert.deepEqual(buildWalletCard(ctx({ next: { ...next, date: "2026-10-18", home: false } }), "1")!.next, { round: "J5", opponent: "C.D. VibraPadel", day: "Dom 18/10", time: null, venue: "Visitante" });
  assert.equal(buildWalletCard(ctx({ next: { ...next, date: "" } }), "1")!.next!.day, "Por confirmar");
});
test("los nombres de club de SNP salen con espacios en lugar de guiones bajos", () => {
  const card = buildWalletCard(ctx({ next: { ...next, opponent: "CD_PADEL_ARCOS" }, last: { fixtureId: "40", round: 4, opponent: "CLUB_RIVAL_X", ours: 7, theirs: 5 } }), "1")!;
  assert.equal(card.next?.opponent, "CD PADEL ARCOS");
  assert.equal(card.nextMatch, "J5 · CD PADEL ARCOS · Dom 18/10 10:00 · Local");
  assert.equal(card.lastResult, "J4 · Fito Raya A 7–5 CLUB RIVAL X");
});

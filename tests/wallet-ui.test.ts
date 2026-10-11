import test from "node:test";
import assert from "node:assert/strict";
import { lineupHref, notifyKindFor, notifySummaryText, usablePairs, walletPlatforms } from "../src/domain/wallet-ui";

const both = { apple: true, google: true };
test("plataformas según el dispositivo y la configuración", () => {
  assert.deepEqual(walletPlatforms("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", both), ["apple"]);
  assert.deepEqual(walletPlatforms("Mozilla/5.0 (Linux; Android 15; Pixel 9)", both), ["google"]);
  assert.deepEqual(walletPlatforms("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", both), ["apple"]);
  assert.deepEqual(walletPlatforms("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", both), ["google"]);
  assert.deepEqual(walletPlatforms("Mozilla/5.0 (X11; Linux x86_64)", both), ["google"]);
  assert.deepEqual(walletPlatforms("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", { apple: false, google: true }), ["google"]);
  assert.deepEqual(walletPlatforms("Mozilla/5.0 (Linux; Android 15; Pixel 9)", { apple: true, google: false }), []);
  assert.deepEqual(walletPlatforms("Mozilla/5.0 (iPhone)", { apple: false, google: true }), []);
  assert.deepEqual(walletPlatforms("Mozilla/5.0 (Windows NT 10.0)", { apple: false, google: true }), ["google"]);
});
test("resumen del aviso para el entrenador", () => {
  assert.equal(notifySummaryText({ total: 16, withoutPass: 2, apple: { enabled: true, ok: 9, failed: 0 }, google: { enabled: true, ok: 4, failed: 1, rateLimited: 1 } }),
    "14 de 16 jugadores tienen la tarjeta. Apple: 9 dispositivos avisados. Google: 4 avisados, 1 sin aviso por el límite de Google, 1 con error.");
  assert.equal(notifySummaryText({ total: 16, withoutPass: 16, apple: { enabled: true, ok: 0, failed: 0 }, google: { enabled: false, ok: 0, failed: 0, rateLimited: 0 } }),
    "Nadie ha añadido todavía la tarjeta.");
  assert.equal(notifySummaryText({ total: 3, withoutPass: 0, apple: { enabled: true, ok: 2, failed: 1 }, google: { enabled: false, ok: 0, failed: 0, rateLimited: 0 } }),
    "3 de 3 jugadores tienen la tarjeta. Apple: 2 dispositivos avisados, 1 con error.");
});
test("qué se puede avisar en cada jornada", () => {
  const fixture = (id: string, date: string, status: "played" | "pending") => ({ id, teamId: "a" as const, round: 1, opponent: "R", date, venue: "", home: true, status, matches: [] });
  const fixtures = [fixture("30", "2026-09-27T08:00:00.000Z", "played"), fixture("40", "2026-10-04T08:00:00.000Z", "played"), fixture("60", "2026-10-25T08:00:00.000Z", "pending"), fixture("70", "2026-11-01T08:00:00.000Z", "pending")];
  const now = Date.parse("2026-10-11T00:00:00Z");
  assert.equal(notifyKindFor(fixtures, "60", now), "lineup");
  assert.equal(notifyKindFor(fixtures, "40", now), "result");
  assert.equal(notifyKindFor(fixtures, "30", now), null);
  assert.equal(notifyKindFor(fixtures, "70", now), null);
});
test("la convocatoria publicada se puede volver a editar aunque alguien haya salido de la plantilla", () => {
  const pairs = [{ id: "p0", players: ["a-1", "a-9"] as [string, string] }, ...[1, 2, 3, 4].map(i => ({ id: `p${i}`, players: [null, null] as [null, null] }))];
  assert.deepEqual(usablePairs(pairs, ["a-1", "a-2"])![0], { id: "p0", players: ["a-1", null] });
  assert.equal(usablePairs(pairs.slice(0, 3), ["a-1"]), null);
});
test("preparar la alineación lleva a la jornada a quien puede publicarla", () => {
  assert.equal(lineupHref("a", "55262", true), "/equipos/a/jornadas/55262#convocatoria");
  assert.equal(lineupHref("a", "55262", false), "/equipos/a/parejas");
});

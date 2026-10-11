import test from "node:test";
import assert from "node:assert/strict";
import { renderStrip, titleSize } from "../src/lib/wallet-strip";
import type { WalletCardData } from "../src/domain/wallet-card";

const card: WalletCardData = { teamId: "a", playerSourceId: "1", teamLabel: "Equipo A", playerName: "Carlos Martin", playerLine: "Carlos Martin · Revés", next: { round: "J5", opponent: "Rival", day: "Dom 18/10", time: "10:00", venue: "Local" }, nextMatch: "J5 · Rival · Dom 18/10 10:00 · Local", lineup: "Convocado J5 · Pareja 2 con Juan Perez", lineupShort: "Pareja 2 con Juan Perez", lastResult: "J4 · Fito Raya A 7–5 Rival X", snpPoints: "20.313", teamPath: "/equipos/a/jornadas", actaPath: "/equipos/a/jornadas/40" };
const size = (png: Buffer) => [png.readUInt32BE(16), png.readUInt32BE(20)];

test("la franja es un PNG de 375x144 pt a 2x y 3x", async () => {
  const [two, three] = await Promise.all([renderStrip(card, 2), renderStrip(card, 3)]);
  assert.equal(two.subarray(1, 4).toString(), "PNG");
  assert.deepEqual(size(two), [750, 288]);
  assert.deepEqual(size(three), [1125, 432]);
});
test("también se dibuja sin hora y sin próximo partido", async () => {
  assert.deepEqual(size(await renderStrip({ ...card, next: { ...card.next!, time: null, venue: "Visitante" } }, 2)), [750, 288]);
  assert.deepEqual(size(await renderStrip({ ...card, next: null }, 2)), [750, 288]);
});
test("los rivales largos se escriben más pequeños", () => {
  assert.equal(titleSize("Equipo rival"), 26);
  assert.equal(titleSize("Pádel Las Rozas"), 22);
  assert.equal(titleSize("Club Pádel Las Rozas Majadahonda B"), 18);
});
test("la convocatoria también se dibuja cuando está pendiente o sin pareja", async () => {
  for (const lineupShort of ["Pendiente", "No convocado", "Pareja 1"]) assert.deepEqual(size(await renderStrip({ ...card, lineupShort }, 2)), [750, 288]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { applePassJson } from "../src/lib/wallet-apple";
import type { WalletCardData } from "../src/domain/wallet-card";

const card: WalletCardData = { teamId: "a", playerSourceId: "1", teamLabel: "Equipo A", playerName: "Carlos Martin", playerLine: "Carlos Martin · Revés", next: { round: "J5", opponent: "Rival", day: "Dom 18/10", time: "10:00", venue: "Local" }, nextMatch: "J5 · Rival · Dom 18/10 10:00 · Local", lineup: "Convocado J5 · Pareja 2 con Juan Perez", lineupShort: "Pareja 2 con Juan Perez", lastResult: "J4 · Fito Raya A 7–5 Rival X", snpPoints: "20.313", teamPath: "/equipos/a/jornadas", actaPath: "/equipos/a/jornadas/40" };
const meta = { serial: "11111111-1111-4111-8111-111111111111", authToken: "t".repeat(43), baseUrl: "https://fito.example.com", passTypeId: "pass.com.fitoraya.equipo", teamIdentifier: "ABCDE12345" };
type Fields = Record<string, { key: string; label: string; value: string; changeMessage?: string }[]>;
const ticket = (data: WalletCardData) => applePassJson(data, meta).eventTicket as Fields;

test("pass.json de entrada con web service, colores y QR", () => {
  const json = applePassJson(card, meta);
  assert.equal(json.formatVersion, 1);
  assert.equal(json.passTypeIdentifier, "pass.com.fitoraya.equipo");
  assert.equal(json.teamIdentifier, "ABCDE12345");
  assert.equal(json.serialNumber, meta.serial);
  assert.equal(json.authenticationToken, meta.authToken);
  assert.equal(json.webServiceURL, "https://fito.example.com/api/wallet/apple");
  assert.equal(json.backgroundColor, "rgb(167, 51, 159)");
  assert.equal(json.foregroundColor, "rgb(255, 255, 255)");
  assert.equal(json.generic, undefined);
  assert.deepEqual(json.barcodes, [{ format: "PKBarcodeFormatQR", message: "https://fito.example.com/mi-perfil", messageEncoding: "iso-8859-1" }]);
});
test("nombre y puntos arriba, Fito Raya vs rival y datos cortos debajo", () => {
  const fields = ticket(card);
  assert.equal(applePassJson(card, meta).logoText, "Carlos Martin");
  assert.deepEqual(fields.headerFields, [{ key: "points", label: "PUNTOS SNP", value: "20.313" }]);
  assert.deepEqual(fields.primaryFields, [{ key: "rival", label: "J5 · PRÓXIMO PARTIDO", value: "Fito Raya vs Rival" }]);
  assert.deepEqual(fields.secondaryFields.map(f => [f.label, f.value]), [["FECHA", "Dom 18/10"], ["HORA", "10:00"], ["CAMPO", "Local"]]);
  assert.deepEqual(fields.auxiliaryFields, [{ key: "lineup", label: "TU CONVOCATORIA J5", value: "Pareja 2 con Juan Perez", changeMessage: "Convocatoria J5: %@" }]);
});
test("solo convocatoria y resultado avisan al cambiar", () => {
  const fields = Object.values(ticket(card)).flat();
  assert.deepEqual(fields.filter(f => f.changeMessage).map(f => [f.key, f.changeMessage]), [["lineup", "Convocatoria J5: %@"], ["result", "%@"]]);
  assert.equal(fields.find(f => f.key === "result")?.value, "J4 · Fito Raya A 7–5 Rival X");
  assert.equal(fields.find(f => f.key === "acta")?.value, "https://fito.example.com/equipos/a/jornadas/40");
});
test("sin hora, sin próximo partido y sin acta", () => {
  assert.deepEqual(ticket({ ...card, next: { ...card.next!, time: null } }).secondaryFields.map(f => f.key), ["day", "venue"]);
  const none = ticket({ ...card, next: null, lineupShort: "Sin convocatoria", actaPath: null });
  assert.deepEqual(none.primaryFields, [{ key: "rival", label: "PRÓXIMO PARTIDO", value: "Sin partidos programados" }]);
  assert.deepEqual(none.secondaryFields, []);
  assert.deepEqual(none.auxiliaryFields, [{ key: "lineup", label: "TU CONVOCATORIA", value: "Sin convocatoria", changeMessage: "Convocatoria: %@" }]);
  assert.equal(none.backFields.some(f => f.key === "acta"), false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { applePassJson } from "../src/lib/wallet-apple";
import type { WalletCardData } from "../src/domain/wallet-card";

const card: WalletCardData = { teamId: "a", playerSourceId: "1", teamLabel: "Equipo A", playerLine: "Carlos Martin · Revés", nextMatch: "J5 · Rival · Dom 18/10 10:00 · Local", lineup: "Convocado J5 · Pareja 2 con Juan Perez", lastResult: "J4 · Fito Raya A 7–5 Rival X", snpPoints: "20.313", teamPath: "/equipos/a/jornadas", actaPath: "/equipos/a/jornadas/40" };
const meta = { serial: "11111111-1111-4111-8111-111111111111", authToken: "t".repeat(43), baseUrl: "https://fito.example.com", passTypeId: "pass.com.fitoraya.equipo", teamIdentifier: "ABCDE12345" };

test("pass.json genérico con web service, colores y QR", () => {
  const json = applePassJson(card, meta);
  assert.equal(json.formatVersion, 1);
  assert.equal(json.passTypeIdentifier, "pass.com.fitoraya.equipo");
  assert.equal(json.teamIdentifier, "ABCDE12345");
  assert.equal(json.serialNumber, meta.serial);
  assert.equal(json.authenticationToken, meta.authToken);
  assert.equal(json.webServiceURL, "https://fito.example.com/api/wallet/apple");
  assert.equal(json.backgroundColor, "rgb(10, 24, 37)");
  assert.equal(json.foregroundColor, "rgb(242, 197, 0)");
  assert.deepEqual(json.barcodes, [{ format: "PKBarcodeFormatQR", message: "https://fito.example.com/mi-perfil", messageEncoding: "iso-8859-1" }]);
});
test("solo convocatoria y resultado avisan al cambiar", () => {
  const generic = applePassJson(card, meta).generic as Record<string, { key: string; value: string; changeMessage?: string }[]>;
  const fields = Object.values(generic).flat();
  assert.deepEqual(fields.filter(f => f.changeMessage).map(f => [f.key, f.changeMessage]), [["lineup", "%@"], ["result", "%@"]]);
  assert.equal(fields.find(f => f.key === "points")?.value, "20.313");
  assert.equal(fields.find(f => f.key === "acta")?.value, "https://fito.example.com/equipos/a/jornadas/40");
});
test("sin acta no hay campo de acta en el reverso", () => {
  const generic = applePassJson({ ...card, actaPath: null }, meta).generic as Record<string, { key: string }[]>;
  assert.equal(generic.backFields.some(f => f.key === "acta"), false);
});

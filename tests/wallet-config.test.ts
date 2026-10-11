import test from "node:test";
import assert from "node:assert/strict";
import { appleConfig, googleConfig, publicBaseUrl, walletAvailability } from "../src/lib/wallet-config";

const b64 = (text: string) => Buffer.from(text).toString("base64");
const apple = { PUBLIC_BASE_URL: "https://fito.example.com/", APPLE_PASS_TYPE_ID: "pass.com.fitoraya.equipo", APPLE_TEAM_ID: "ABCDE12345", APPLE_PASS_CERT: b64("CERT"), APPLE_PASS_KEY: b64("KEY"), APPLE_WWDR_CERT: b64("WWDR") };
const google = { PUBLIC_BASE_URL: "https://fito.example.com", GOOGLE_WALLET_ISSUER_ID: "3388000000012345678", GOOGLE_WALLET_SA_JSON: b64(JSON.stringify({ client_email: "wallet@fito.iam.gserviceaccount.com", private_key: "PK" })) };

test("la URL pública solo vale con https y se queda en el origen", () => {
  assert.equal(publicBaseUrl({ PUBLIC_BASE_URL: "https://fito.example.com/ruta/" }), "https://fito.example.com");
  assert.equal(publicBaseUrl({ PUBLIC_BASE_URL: "http://fito.example.com" }), null);
  assert.equal(publicBaseUrl({ PUBLIC_BASE_URL: "no es url" }), null);
  assert.equal(publicBaseUrl({}), null);
});
test("Apple decodifica los PEM en base64 y exige todas las variables", () => {
  assert.deepEqual(appleConfig(apple), { passTypeId: "pass.com.fitoraya.equipo", teamId: "ABCDE12345", cert: "CERT", key: "KEY", wwdr: "WWDR" });
  assert.equal(appleConfig({ ...apple, APPLE_PASS_KEY_PASSPHRASE: "secreto" })?.passphrase, "secreto");
  assert.equal(appleConfig({ ...apple, APPLE_WWDR_CERT: undefined }), null);
  assert.equal(appleConfig({ ...apple, PUBLIC_BASE_URL: undefined }), null);
});
test("Google lee la cuenta de servicio y rechaza JSON roto", () => {
  assert.deepEqual(googleConfig(google), { issuerId: "3388000000012345678", clientEmail: "wallet@fito.iam.gserviceaccount.com", privateKey: "PK" });
  assert.equal(googleConfig({ ...google, GOOGLE_WALLET_SA_JSON: b64("{roto") }), null);
  assert.equal(googleConfig({ ...google, GOOGLE_WALLET_SA_JSON: b64("{}") }), null);
});
test("disponibilidad por plataforma", () => {
  assert.deepEqual(walletAvailability({ ...apple, ...google }), { apple: true, google: true });
  assert.deepEqual(walletAvailability(google), { apple: false, google: true });
  assert.deepEqual(walletAvailability({}), { apple: false, google: false });
});

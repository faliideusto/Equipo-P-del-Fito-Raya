import test from "node:test";
import assert from "node:assert/strict";
import { authorizedPass, registerDevice, unregisterDevice, updatedSerials } from "../src/lib/wallet-apple-service";
import { memoryWalletStore, type WalletPass } from "../src/lib/wallet-store";

const TYPE = "pass.com.fitoraya.equipo";
const serial = "11111111-1111-4111-8111-111111111111";
const token = "t".repeat(43);
async function setup() {
  const store = memoryWalletStore();
  const pass: WalletPass = { serial, player_id: "1", team_id: "a", auth_token: token, google_object_id: null, updated_at: "2026-10-11T10:00:00.000Z" };
  await store.createPass(pass);
  return store;
}
const base = { deviceId: "abc123", passTypeId: TYPE, expectedType: TYPE, serial, authorization: `ApplePass ${token}` };

test("autorización: token, tipo y serial", async () => {
  const store = await setup();
  assert.equal((await authorizedPass(store, base))?.serial, serial);
  assert.equal(await authorizedPass(store, { ...base, authorization: `ApplePass ${"x".repeat(43)}` }), null);
  assert.equal(await authorizedPass(store, { ...base, authorization: "ApplePass corto" }), null);
  assert.equal(await authorizedPass(store, { ...base, authorization: null }), null);
  assert.equal(await authorizedPass(store, { ...base, passTypeId: "pass.otro" }), null);
  assert.equal(await authorizedPass(store, { ...base, serial: "../../etc" }), null);
});
test("registro 201, repetido 200, sin token 401, datos malos 400 y baja", async () => {
  const store = await setup();
  assert.equal(await registerDevice(store, { ...base, pushToken: "a1b2" }), 201);
  assert.equal(await registerDevice(store, { ...base, pushToken: "a1b2" }), 200);
  assert.equal(await registerDevice(store, { ...base, authorization: null, pushToken: "a1b2" }), 401);
  assert.equal(await registerDevice(store, { ...base, pushToken: 42 }), 400);
  assert.equal(await registerDevice(store, { ...base, deviceId: "no válido", pushToken: "a1b2" }), 400);
  assert.equal(store.devices.length, 1);
  assert.equal(await unregisterDevice(store, { ...base, authorization: null }), 401);
  assert.equal(await unregisterDevice(store, base), 200);
  assert.equal(store.devices.length, 0);
});
test("tarjetas actualizadas: sin marca, marca vieja, futura y no numérica", async () => {
  const store = await setup();
  await registerDevice(store, { ...base, pushToken: "a1b2" });
  const updatedAt = Date.parse("2026-10-11T10:00:00.000Z");
  const input = { deviceId: "abc123", passTypeId: TYPE, expectedType: TYPE };
  assert.deepEqual(await updatedSerials(store, { ...input, since: null }), { status: 200, body: { serialNumbers: [serial], lastUpdated: String(updatedAt) } });
  assert.deepEqual(await updatedSerials(store, { ...input, since: String(updatedAt - 1) }), { status: 200, body: { serialNumbers: [serial], lastUpdated: String(updatedAt) } });
  assert.deepEqual(await updatedSerials(store, { ...input, since: String(updatedAt) }), { status: 204 });
  assert.deepEqual(await updatedSerials(store, { ...input, since: "9999999999999" }), { status: 204 });
  assert.deepEqual(await updatedSerials(store, { ...input, since: "ayer" }), { status: 200, body: { serialNumbers: [serial], lastUpdated: String(updatedAt) } });
  assert.deepEqual(await updatedSerials(store, { ...input, deviceId: "otro", since: null }), { status: 204 });
  assert.deepEqual(await updatedSerials(store, { ...input, passTypeId: "pass.otro", since: null }), { status: 400 });
});

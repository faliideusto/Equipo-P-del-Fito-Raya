import { timingSafeEqual } from "node:crypto";
import type { WalletPass, WalletStore } from "./wallet-store";
const SERIAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DEVICE = /^[A-Za-z0-9]{1,64}$/;
const PUSH_TOKEN = /^[A-Fa-f0-9]{1,200}$/;
export const validSerial = (value: string) => SERIAL.test(value);
type PassRequest = { passTypeId: string; expectedType: string; serial: string; authorization: string | null };
// Wallet sends "Authorization: ApplePass <authenticationToken>" on every pass-specific call.
export async function authorizedPass(store: WalletStore, { passTypeId, expectedType, serial, authorization }: PassRequest): Promise<WalletPass | null> {
  if (passTypeId !== expectedType || !validSerial(serial) || !authorization?.startsWith("ApplePass ")) return null;
  const pass = await store.passBySerial(serial); if (!pass) return null;
  const expected = Buffer.from(pass.auth_token); const provided = Buffer.from(authorization.slice("ApplePass ".length));
  return expected.length === provided.length && timingSafeEqual(expected, provided) ? pass : null;
}
export async function registerDevice(store: WalletStore, input: PassRequest & { deviceId: string; pushToken: unknown }): Promise<200 | 201 | 400 | 401> {
  if (!DEVICE.test(input.deviceId)) return 400;
  const pass = await authorizedPass(store, input); if (!pass) return 401;
  if (typeof input.pushToken !== "string" || !PUSH_TOKEN.test(input.pushToken)) return 400;
  return (await store.addDevice({ device_id: input.deviceId, serial: pass.serial, push_token: input.pushToken })) === "created" ? 201 : 200;
}
export async function unregisterDevice(store: WalletStore, input: PassRequest & { deviceId: string }): Promise<200 | 400 | 401> {
  if (!DEVICE.test(input.deviceId)) return 400;
  const pass = await authorizedPass(store, input); if (!pass) return 401;
  await store.removeDevice(input.deviceId, pass.serial); return 200;
}
// The update tag is the newest updated_at in epoch milliseconds; a missing or bad tag lists every pass.
export async function updatedSerials(store: WalletStore, { deviceId, passTypeId, expectedType, since }: { deviceId: string; passTypeId: string; expectedType: string; since: string | null }): Promise<{ status: 200; body: { serialNumbers: string[]; lastUpdated: string } } | { status: 204 | 400 }> {
  if (passTypeId !== expectedType || !DEVICE.test(deviceId)) return { status: 400 };
  const after = since && /^\d{1,15}$/.test(since) ? Number(since) : 0;
  const updated = (await store.devicePasses(deviceId)).filter(p => Date.parse(p.updated_at) > after);
  if (!updated.length) return { status: 204 };
  return { status: 200, body: { serialNumbers: updated.map(p => p.serial), lastUpdated: String(Math.max(...updated.map(p => Date.parse(p.updated_at)))) } };
}

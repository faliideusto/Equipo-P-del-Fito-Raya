import test from "node:test";
import assert from "node:assert/strict";
import { notifyTeam, type NotifyChannels } from "../src/lib/wallet-notify";
import { memoryWalletStore, type WalletPass } from "../src/lib/wallet-store";
import type { TeamCardContext } from "../src/domain/wallet-card";
import type { PushOutcome } from "../src/lib/wallet-apns";

const ctx: TeamCardContext = {
  teamId: "a",
  players: [{ id: "a-1", sourceId: "1", name: "Uno", position: null, points: 1 }, { id: "a-2", sourceId: "2", name: "Dos", position: null, points: 1 }, { id: "a-3", sourceId: "3", name: "Tres", position: null, points: 1 }],
  next: { id: "50", round: 5, opponent: "Rival", date: "", home: true },
  published: { fixtureId: "50", pairs: [{ id: "p", players: ["a-1", "a-2"] }] },
  last: null,
};
const uuid = (n: number) => `${String(n).repeat(8)}-1111-4111-8111-111111111111`;
const pass = (n: number, playerId: string, team: "a" | "b", google: boolean): WalletPass => ({ serial: uuid(n), player_id: playerId, team_id: team, auth_token: "t".repeat(43), google_object_id: google ? `3388.${uuid(n)}` : null, updated_at: "2026-10-01T00:00:00.000Z" });
async function setup() {
  const store = memoryWalletStore();
  await store.createPass(pass(1, "1", "a", true));   // in roster, Google + Apple
  await store.createPass(pass(2, "2", "a", false));  // in roster, Apple only
  await store.createPass(pass(3, "9", "a", true));   // left the roster
  await store.createPass(pass(4, "1", "b", true));   // same player, other team
  await store.addDevice({ device_id: "d1", serial: uuid(1), push_token: "aa" });
  await store.addDevice({ device_id: "d2", serial: uuid(2), push_token: "bb" });
  await store.addDevice({ device_id: "d3", serial: uuid(3), push_token: "cc" });
  await store.addDevice({ device_id: "d4", serial: uuid(4), push_token: "dd" });
  return store;
}

test("avisa solo a las tarjetas del equipo que siguen en la plantilla", async () => {
  const store = await setup();
  const googleCalls: { serial: string; body: string | undefined }[] = []; const pushed: string[][] = [];
  const channels: NotifyChannels = {
    google: async (p, _card, notice) => { googleCalls.push({ serial: p.serial, body: notice?.body }); return "ok"; },
    apple: async tokens => { pushed.push(tokens); return new Map<string, PushOutcome>(tokens.map(t => [t, t === "bb" ? "unregistered" : "ok"])); },
  };
  const now = new Date("2026-10-11T12:00:00.000Z");
  const summary = await notifyTeam({ store, ctx, kind: "lineup", channels, now });
  assert.deepEqual(summary, { total: 3, withoutPass: 1, apple: { enabled: true, ok: 1, failed: 0 }, google: { enabled: true, ok: 1, failed: 0, rateLimited: 0 } });
  assert.deepEqual(googleCalls, [{ serial: uuid(1), body: "Convocado J5 · Pareja 1 con Dos" }]);
  assert.deepEqual(pushed, [["aa", "bb"]]);
  assert.deepEqual(store.devices.map(d => d.push_token), ["aa", "cc", "dd"]);
  assert.deepEqual(store.passes.map(p => p.updated_at), [now.toISOString(), now.toISOString(), "2026-10-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z"]);
});
test("errores, límite de Google, tarjeta no guardada y canales desactivados", async () => {
  const store = await setup();
  const outcomes = ["rateLimited", "missing"] as const; let i = 0;
  const google: NotifyChannels["google"] = async () => outcomes[i++ % 2];
  const summary = await notifyTeam({ store, ctx, kind: "result", channels: { google, apple: async tokens => new Map<string, PushOutcome>(tokens.map(t => [t, "failed"])) }, now: new Date() });
  assert.deepEqual(summary.google, { enabled: true, ok: 0, failed: 0, rateLimited: 1 });
  assert.deepEqual(summary.apple, { enabled: true, ok: 0, failed: 2 });
  const off = await notifyTeam({ store: await setup(), ctx, kind: "lineup", channels: { google: null, apple: null }, now: new Date() });
  assert.deepEqual(off, { total: 3, withoutPass: 1, apple: { enabled: false, ok: 0, failed: 0 }, google: { enabled: false, ok: 0, failed: 0, rateLimited: 0 } });
});
test("al borrar la convocatoria las tarjetas vuelven a pendiente y se avisa", async () => {
  const store = await setup();
  const bodies: (string | undefined)[] = [];
  const summary = await notifyTeam({ store, ctx: { ...ctx, published: null }, kind: "lineup", channels: { google: async (_p, card, notice) => { bodies.push(card.lineupShort, notice?.body); return "ok"; }, apple: async tokens => new Map<string, PushOutcome>(tokens.map(t => [t, "ok"])) }, now: new Date() });
  assert.deepEqual(bodies, ["Pendiente", "Convocatoria J5 pendiente"]);
  assert.equal(summary.apple.ok, 2);
});

import { accountConfig, AccountError } from "./account-auth";
import type { Pair, TeamId } from "@/domain/types";
export type WalletPass = { serial: string; player_id: string; team_id: TeamId; auth_token: string; google_object_id: string | null; updated_at: string };
export type WalletDevice = { device_id: string; serial: string; push_token: string };
export type PublishedLineup = { team_id: TeamId; fixture_id: string; lineup_id: string | null; pairs: Pair[]; published_at: string };
export interface WalletStore {
  passBySerial(serial: string): Promise<WalletPass | null>;
  passFor(playerId: string, teamId: TeamId): Promise<WalletPass | null>;
  createPass(pass: WalletPass): Promise<WalletPass>;
  setGoogleObject(serial: string, objectId: string): Promise<void>;
  teamPasses(teamId: TeamId): Promise<WalletPass[]>;
  touchPasses(serials: string[], at: string): Promise<void>;
  addDevice(device: WalletDevice): Promise<"created" | "exists">;
  removeDevice(deviceId: string, serial: string): Promise<void>;
  removePushToken(pushToken: string): Promise<void>;
  devicesFor(serials: string[]): Promise<WalletDevice[]>;
  devicePasses(deviceId: string): Promise<WalletPass[]>;
  publishedLineup(teamId: TeamId, fixtureId: string): Promise<PublishedLineup | null>;
  publishLineup(row: PublishedLineup): Promise<void>;
  unpublishLineup(teamId: TeamId, fixtureId: string): Promise<void>;
}
function remove<T>(rows: T[], match: (row: T) => boolean) { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i])) rows.splice(i, 1); }
// Test double with the same contract as Supabase.
export function memoryWalletStore(): WalletStore & { passes: WalletPass[]; devices: WalletDevice[]; lineups: PublishedLineup[] } {
  const passes: WalletPass[] = []; const devices: WalletDevice[] = []; const lineups: PublishedLineup[] = [];
  return {
    passes, devices, lineups,
    async passBySerial(serial) { return passes.find(p => p.serial === serial) ?? null; },
    async passFor(playerId, teamId) { return passes.find(p => p.player_id === playerId && p.team_id === teamId) ?? null; },
    async createPass(pass) { const existing = passes.find(p => p.player_id === pass.player_id && p.team_id === pass.team_id); if (existing) return existing; passes.push(pass); return pass; },
    async setGoogleObject(serial, objectId) { const pass = passes.find(p => p.serial === serial); if (pass) pass.google_object_id = objectId; },
    async teamPasses(teamId) { return passes.filter(p => p.team_id === teamId); },
    async touchPasses(serials, at) { for (const pass of passes) if (serials.includes(pass.serial)) pass.updated_at = at; },
    async addDevice(device) {
      const existing = devices.find(d => d.device_id === device.device_id && d.serial === device.serial);
      if (existing) { existing.push_token = device.push_token; return "exists"; }
      devices.push(device); return "created";
    },
    async removeDevice(deviceId, serial) { remove(devices, d => d.device_id === deviceId && d.serial === serial); },
    async removePushToken(token) { remove(devices, d => d.push_token === token); },
    async devicesFor(serials) { return devices.filter(d => serials.includes(d.serial)); },
    async devicePasses(deviceId) { const serials = devices.filter(d => d.device_id === deviceId).map(d => d.serial); return passes.filter(p => serials.includes(p.serial)); },
    async publishedLineup(teamId, fixtureId) { return lineups.find(l => l.team_id === teamId && l.fixture_id === fixtureId) ?? null; },
    async publishLineup(row) { remove(lineups, l => l.team_id === row.team_id && l.fixture_id === row.fixture_id); lineups.push(row); },
    async unpublishLineup(teamId, fixtureId) { remove(lineups, l => l.team_id === teamId && l.fixture_id === fixtureId); },
  };
}
const PASS_FIELDS = "serial,player_id,team_id,auth_token,google_object_id,updated_at";
const inList = (values: string[]) => `in.(${values.join(",")})`;
export function supabaseWalletStore({ url, key }: { url: string; key: string }, fetchImpl: typeof fetch = fetch): WalletStore {
  async function rest<T>(table: string, method: string, params: Record<string, string>, body?: object, prefer = "return=minimal"): Promise<T> {
    const endpoint = new URL(`/rest/v1/${table}`, url);
    if (endpoint.protocol !== "https:") throw new Error("URL no válida");
    for (const [k, v] of Object.entries(params)) endpoint.searchParams.set(k, v);
    const response = await fetchImpl(endpoint, { method, cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", Prefer: prefer }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 404) { const error = await response.json().catch(() => ({})); if (error.code === "PGRST205" || error.code === "42P01") throw new AccountError("Faltan las tablas de Wallet. Ejecuta supabase/wallet.sql en Supabase.", 503); }
    if (!response.ok) throw new AccountError("No se pudo acceder a los datos de Wallet.", 503);
    return (method === "GET" ? await response.json() : null) as T;
  }
  const passes = (params: Record<string, string>) => rest<WalletPass[]>("wallet_passes", "GET", { select: PASS_FIELDS, ...params });
  return {
    async passBySerial(serial) { return (await passes({ serial: `eq.${serial}` }))[0] ?? null; },
    async passFor(playerId, teamId) { return (await passes({ player_id: `eq.${playerId}`, team_id: `eq.${teamId}` }))[0] ?? null; },
    async createPass(pass) {
      await rest("wallet_passes", "POST", { on_conflict: "player_id,team_id" }, pass, "resolution=ignore-duplicates,return=minimal");
      return (await passes({ player_id: `eq.${pass.player_id}`, team_id: `eq.${pass.team_id}` }))[0];
    },
    async setGoogleObject(serial, objectId) { await rest("wallet_passes", "PATCH", { serial: `eq.${serial}` }, { google_object_id: objectId }); },
    teamPasses: teamId => passes({ team_id: `eq.${teamId}` }),
    async touchPasses(serials, at) { if (serials.length) await rest("wallet_passes", "PATCH", { serial: inList(serials) }, { updated_at: at }); },
    async addDevice(device) {
      const existing = await rest<WalletDevice[]>("wallet_devices", "GET", { select: "device_id", device_id: `eq.${device.device_id}`, serial: `eq.${device.serial}` });
      await rest("wallet_devices", "POST", { on_conflict: "device_id,serial" }, device, "resolution=merge-duplicates,return=minimal");
      return existing.length ? "exists" : "created";
    },
    async removeDevice(deviceId, serial) { await rest("wallet_devices", "DELETE", { device_id: `eq.${deviceId}`, serial: `eq.${serial}` }); },
    async removePushToken(token) { await rest("wallet_devices", "DELETE", { push_token: `eq.${token}` }); },
    async devicesFor(serials) { return serials.length ? rest<WalletDevice[]>("wallet_devices", "GET", { select: "device_id,serial,push_token", serial: inList(serials) }) : []; },
    async devicePasses(deviceId) {
      const rows = await rest<{ serial: string }[]>("wallet_devices", "GET", { select: "serial", device_id: `eq.${deviceId}` });
      return rows.length ? passes({ serial: inList(rows.map(r => r.serial)) }) : [];
    },
    async publishedLineup(teamId, fixtureId) { return (await rest<PublishedLineup[]>("published_lineups", "GET", { select: "team_id,fixture_id,lineup_id,pairs,published_at", team_id: `eq.${teamId}`, fixture_id: `eq.${fixtureId}` }))[0] ?? null; },
    async publishLineup(row) { await rest("published_lineups", "POST", { on_conflict: "team_id,fixture_id" }, row, "resolution=merge-duplicates,return=minimal"); },
    async unpublishLineup(teamId, fixtureId) { await rest("published_lineups", "DELETE", { team_id: `eq.${teamId}`, fixture_id: `eq.${fixtureId}` }); },
  };
}
export const walletStore = (): WalletStore => supabaseWalletStore(accountConfig());

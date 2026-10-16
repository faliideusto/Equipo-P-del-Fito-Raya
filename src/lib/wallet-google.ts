import { createHash, createSign } from "node:crypto";
import type { TeamId } from "@/domain/types";
import { arrivalLine, type WalletCardData } from "@/domain/wallet-card";
import type { GoogleConfig } from "./wallet-config";
import { mapsSearchUrl } from "@/domain/team-result-message";
const API = "https://walletobjects.googleapis.com/walletobjects/v1";
const MESSAGE_DAYS = 3;
export type GoogleOutcome = "ok" | "rateLimited" | "missing" | "failed";
const text = (value: string) => ({ defaultValue: { language: "es", value } });
export const googleClassId = (issuerId: string, teamId: TeamId) => `${issuerId}.fito-raya-${teamId}`;
export const googleObjectId = (issuerId: string, serial: string) => `${issuerId}.${serial}`;
// Google caches images by URL, so the hero URL carries a hash of what it draws and changes when that does.
export const heroVersion = (card: WalletCardData) => createHash("sha256").update(JSON.stringify([card.next, card.lineupShort])).digest("hex").slice(0, 12);
// Same look as the Apple pass: pink card, round logo, and the match and lineup drawn by the server in the hero image.
export function googleObject(card: WalletCardData, { issuerId, serial, baseUrl }: { issuerId: string; serial: string; baseUrl: string }): Record<string, unknown> {
  return {
    id: googleObjectId(issuerId, serial), classId: googleClassId(issuerId, card.teamId), state: "ACTIVE", hexBackgroundColor: "#c2287a",
    logo: { sourceUri: { uri: `${baseUrl}/wallet/logo@3x.png` } },
    heroImage: { sourceUri: { uri: `${baseUrl}/api/wallet/google/hero/${serial}?v=${heroVersion(card)}` }, contentDescription: text(card.nextMatch) },
    cardTitle: text(`Fito Raya · ${card.teamLabel}`), subheader: text(`Puntos SNP · ${card.snpPoints}`), header: text(card.playerName),
    textModulesData: [
      { id: "next", header: "Próximo partido", body: card.nextMatch },
      ...(card.next?.arrival ? [{ id: "arrival", header: "Presentación", body: arrivalLine(card.next.arrival) }] : []),
      ...(card.next?.place ? [{ id: "place", header: "Lugar", body: card.next.place }] : []),
      { id: "lineup", header: "Convocatoria", body: card.lineup },
      { id: "result", header: "Último resultado", body: card.lastResult },
      { id: "points", header: "Puntos SNP", body: card.snpPoints },
    ],
    linksModuleData: { uris: [...(card.next?.place ? [{ id: "maps", uri: mapsSearchUrl(card.next.place), description: `Cómo llegar · ${card.next.place}` }] : []), { id: "web", uri: `${baseUrl}${card.teamPath}`, description: "Web del equipo" }, ...(card.actaPath ? [{ id: "acta", uri: `${baseUrl}${card.actaPath}`, description: "Acta de la última jornada" }] : [])] },
    barcode: { type: "QR_CODE", value: `${baseUrl}/mi-perfil` },
  };
}
export function signJwt(claims: object, privateKey: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const data = `${encode({ alg: "RS256", typ: "JWT" })}.${encode(claims)}`;
  return `${data}.${createSign("RSA-SHA256").update(data).sign(privateKey, "base64url")}`;
}
// Saving the link creates the team class and the player object in Google Wallet.
export function googleSaveUrl(card: WalletCardData, meta: { serial: string; baseUrl: string }, config: GoogleConfig, now = Date.now()): string {
  const claims = { iss: config.clientEmail, aud: "google", typ: "savetowallet", iat: Math.floor(now / 1000), origins: [meta.baseUrl], payload: { genericClasses: [{ id: googleClassId(config.issuerId, card.teamId) }], genericObjects: [googleObject(card, { issuerId: config.issuerId, ...meta })] } };
  return `https://pay.google.com/gp/v/save/${signJwt(claims, config.privateKey)}`;
}
export function googleWalletClient(config: GoogleConfig, fetchImpl: typeof fetch = fetch, clock: () => number = Date.now) {
  let token: { value: string; expires: number } | null = null;
  async function accessToken() {
    if (token && token.expires > clock() + 60000) return token.value;
    const now = Math.floor(clock() / 1000);
    const assertion = signJwt({ iss: config.clientEmail, scope: "https://www.googleapis.com/auth/wallet_object.issuer", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }, config.privateKey);
    const response = await fetchImpl("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Google no ha aceptado la cuenta de servicio.");
    const data = await response.json();
    token = { value: data.access_token, expires: clock() + data.expires_in * 1000 };
    return token.value;
  }
  async function call(path: string, method: string, body: object) {
    return fetchImpl(`${API}${path}`, { method, headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  }
  // Players cannot dismiss Google Wallet messages, so every update clears the old ones and each new one hides itself after a while.
  return {
    async update(objectId: string, object: object, notice: { header: string; body: string } | null, messageId: string): Promise<GoogleOutcome> {
      try {
        const path = `/genericObject/${encodeURIComponent(objectId)}`;
        const patched = await call(path, "PATCH", { ...object, messages: [] });
        if (patched.status === 404) return "missing";
        if (!patched.ok) return "failed";
        if (!notice) return "ok";
        const message = await call(`${path}/addMessage`, "POST", { message: { id: messageId, header: notice.header, body: notice.body, messageType: "TEXT_AND_NOTIFY", displayInterval: { start: { date: new Date(clock()).toISOString() }, end: { date: new Date(clock() + MESSAGE_DAYS * 86400000).toISOString() } } } });
        return message.ok ? "ok" : message.status === 429 ? "rateLimited" : "failed";
      } catch { return "failed"; }
    },
  };
}

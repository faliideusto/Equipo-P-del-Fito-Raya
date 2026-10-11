import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PKPass } from "passkit-generator";
import type { WalletCardData } from "@/domain/wallet-card";
import type { AppleConfig } from "./wallet-config";
import { renderStrip } from "./wallet-strip";
export type ApplePassMeta = { serial: string; authToken: string; baseUrl: string; passTypeId: string; teamIdentifier: string };
type Field = { key: string; label: string; value: string; changeMessage?: string };
// Store card, for its tall strip (375x144 pt): player and points on top, the match and the lineup drawn in the strip image (wallet-strip.tsx).
// No front fields under the strip repeat them; the back keeps both as text.
// Apple notifies on a field whose value changed only when it has a changeMessage, back fields included.
export function applePassJson(card: WalletCardData, meta: ApplePassMeta): Record<string, unknown> {
  const next = card.next; const round = next ? ` ${next.round}` : "";
  const back: Field[] = [
    { key: "lineup", label: `Tu convocatoria${round}`, value: card.lineupShort, changeMessage: `Convocatoria${round}: %@` },
    { key: "player", label: "Jugador", value: card.playerLine }, { key: "team", label: "Equipo", value: `Fito Raya ${card.teamId.toUpperCase()}` },
    { key: "result", label: "Último resultado", value: card.lastResult, changeMessage: "%@" }, { key: "next", label: "Próximo partido", value: card.nextMatch },
    { key: "web", label: "Web del equipo", value: `${meta.baseUrl}${card.teamPath}` },
    ...(card.actaPath ? [{ key: "acta", label: "Acta de la última jornada", value: `${meta.baseUrl}${card.actaPath}` }] : []),
  ];
  return {
    formatVersion: 1, passTypeIdentifier: meta.passTypeId, teamIdentifier: meta.teamIdentifier, serialNumber: meta.serial,
    authenticationToken: meta.authToken, webServiceURL: `${meta.baseUrl}/api/wallet/apple`,
    organizationName: "Escuela Fito Raya", description: `Tarjeta Fito Raya · ${card.teamLabel}`, logoText: card.playerName,
    backgroundColor: "rgb(76, 29, 149)", foregroundColor: "rgb(255, 255, 255)", labelColor: "rgb(255, 227, 241)",
    storeCard: {
      headerFields: [{ key: "points", label: "PUNTOS SNP", value: card.snpPoints }],
      backFields: back,
    },
    barcodes: [{ format: "PKBarcodeFormatQR", message: `${meta.baseUrl}/mi-perfil`, messageEncoding: "iso-8859-1" }],
  };
}
// Icon and round logo are fixed; the strip is drawn for each card.
let images: Promise<Record<string, Buffer>> | null = null;
function passImages() {
  const file = (...path: string[]) => readFile(join(process.cwd(), "public", ...path));
  images ??= Promise.all([file("apple-touch-icon.png"), file("wallet", "logo.png"), file("wallet", "logo@2x.png"), file("wallet", "logo@3x.png")])
    .then(([icon, logo, logo2, logo3]) => ({ "icon.png": icon, "icon@2x.png": icon, "logo.png": logo, "logo@2x.png": logo2, "logo@3x.png": logo3 }))
    .catch(error => { images = null; throw error; });
  return images;
}
// Every iPhone is 2x or 3x, so the 1x strip reuses the 2x drawing.
async function stripImages(card: WalletCardData): Promise<Record<string, Buffer>> {
  const [strip2, strip3] = await Promise.all([renderStrip(card, 2), renderStrip(card, 3)]);
  return { "strip.png": strip2, "strip@2x.png": strip2, "strip@3x.png": strip3 };
}
export async function signApplePass(card: WalletCardData, meta: { serial: string; authToken: string; baseUrl: string }, config: AppleConfig): Promise<Buffer> {
  const json = applePassJson(card, { ...meta, passTypeId: config.passTypeId, teamIdentifier: config.teamId });
  const pass = new PKPass({ ...(await passImages()), ...(await stripImages(card)), "pass.json": Buffer.from(JSON.stringify(json)) }, { wwdr: config.wwdr, signerCert: config.cert, signerKey: config.key, ...(config.passphrase ? { signerKeyPassphrase: config.passphrase } : {}) });
  return pass.getAsBuffer();
}

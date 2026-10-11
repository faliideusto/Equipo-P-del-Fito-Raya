import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PKPass } from "passkit-generator";
import type { WalletCardData } from "@/domain/wallet-card";
import type { AppleConfig } from "./wallet-config";
export type ApplePassMeta = { serial: string; authToken: string; baseUrl: string; passTypeId: string; teamIdentifier: string };
type Field = { key: string; label: string; value: string; changeMessage?: string };
// Event ticket on the pink-to-purple kit gradient: player and points on top, "Fito Raya vs rival", then short fields so nothing is cut.
// Apple notifies on a field whose value changed only when it has a changeMessage.
export function applePassJson(card: WalletCardData, meta: ApplePassMeta): Record<string, unknown> {
  const next = card.next; const round = next ? ` ${next.round}` : "";
  const back: Field[] = [
    { key: "player", label: "Jugador", value: card.playerLine }, { key: "team", label: "Equipo", value: `Fito Raya ${card.teamId.toUpperCase()}` },
    { key: "result", label: "Último resultado", value: card.lastResult, changeMessage: "%@" }, { key: "next", label: "Próximo partido", value: card.nextMatch },
    { key: "web", label: "Web del equipo", value: `${meta.baseUrl}${card.teamPath}` },
    ...(card.actaPath ? [{ key: "acta", label: "Acta de la última jornada", value: `${meta.baseUrl}${card.actaPath}` }] : []),
  ];
  return {
    formatVersion: 1, passTypeIdentifier: meta.passTypeId, teamIdentifier: meta.teamIdentifier, serialNumber: meta.serial,
    authenticationToken: meta.authToken, webServiceURL: `${meta.baseUrl}/api/wallet/apple`,
    organizationName: "Escuela Fito Raya", description: `Tarjeta Fito Raya · ${card.teamLabel}`, logoText: card.playerName,
    backgroundColor: "rgb(167, 51, 159)", foregroundColor: "rgb(255, 255, 255)", labelColor: "rgb(255, 214, 236)",
    eventTicket: {
      headerFields: [{ key: "points", label: "PUNTOS SNP", value: card.snpPoints }],
      primaryFields: [{ key: "rival", label: next ? `${next.round} · PRÓXIMO PARTIDO` : "PRÓXIMO PARTIDO", value: next ? `Fito Raya vs ${next.opponent}` : "Sin partidos programados" }],
      secondaryFields: next ? [{ key: "day", label: "FECHA", value: next.day }, ...(next.time ? [{ key: "time", label: "HORA", value: next.time }] : []), { key: "venue", label: "CAMPO", value: next.venue }] : [],
      auxiliaryFields: [{ key: "lineup", label: `TU CONVOCATORIA${round}`, value: card.lineupShort, changeMessage: `Convocatoria${round}: %@` }],
      backFields: back,
    },
    barcodes: [{ format: "PKBarcodeFormatQR", message: `${meta.baseUrl}/mi-perfil`, messageEncoding: "iso-8859-1" }],
  };
}
// Round logo and the gradient background (Wallet blurs it); an event ticket with a background has no strip.
let images: Promise<Record<string, Buffer>> | null = null;
function passImages() {
  const file = (...path: string[]) => readFile(join(process.cwd(), "public", ...path));
  images ??= Promise.all([file("apple-touch-icon.png"), ...["", "@2x", "@3x"].flatMap(suffix => [file("wallet", `logo${suffix}.png`), file("wallet", `background${suffix}.png`)])])
    .then(([icon, logo, background, logo2, background2, logo3, background3]) => ({
      "icon.png": icon, "icon@2x.png": icon, "logo.png": logo, "logo@2x.png": logo2, "logo@3x.png": logo3,
      "background.png": background, "background@2x.png": background2, "background@3x.png": background3,
    }))
    .catch(error => { images = null; throw error; });
  return images;
}
export async function signApplePass(card: WalletCardData, meta: { serial: string; authToken: string; baseUrl: string }, config: AppleConfig): Promise<Buffer> {
  const json = applePassJson(card, { ...meta, passTypeId: config.passTypeId, teamIdentifier: config.teamId });
  const pass = new PKPass({ ...(await passImages()), "pass.json": Buffer.from(JSON.stringify(json)) }, { wwdr: config.wwdr, signerCert: config.cert, signerKey: config.key, ...(config.passphrase ? { signerKeyPassphrase: config.passphrase } : {}) });
  return pass.getAsBuffer();
}

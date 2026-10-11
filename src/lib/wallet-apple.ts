import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PKPass } from "passkit-generator";
import type { WalletCardData } from "@/domain/wallet-card";
import type { AppleConfig } from "./wallet-config";
export type ApplePassMeta = { serial: string; authToken: string; baseUrl: string; passTypeId: string; teamIdentifier: string };
// Apple notifies on a field whose value changed only when it has a changeMessage.
export function applePassJson(card: WalletCardData, meta: ApplePassMeta): Record<string, unknown> {
  return {
    formatVersion: 1, passTypeIdentifier: meta.passTypeId, teamIdentifier: meta.teamIdentifier, serialNumber: meta.serial,
    authenticationToken: meta.authToken, webServiceURL: `${meta.baseUrl}/api/wallet/apple`,
    organizationName: "Escuela Fito Raya", description: `Tarjeta Fito Raya · ${card.teamLabel}`, logoText: "Fito Raya",
    backgroundColor: "rgb(10, 24, 37)", foregroundColor: "rgb(242, 197, 0)", labelColor: "rgb(255, 255, 255)",
    generic: {
      headerFields: [{ key: "team", label: "EQUIPO", value: card.teamId.toUpperCase() }],
      primaryFields: [{ key: "player", label: "JUGADOR", value: card.playerLine }],
      secondaryFields: [{ key: "next", label: "PRÓXIMO PARTIDO", value: card.nextMatch }, { key: "lineup", label: "CONVOCATORIA", value: card.lineup, changeMessage: "%@" }],
      auxiliaryFields: [{ key: "result", label: "ÚLTIMO RESULTADO", value: card.lastResult, changeMessage: "%@" }, { key: "points", label: "PUNTOS SNP", value: card.snpPoints }],
      backFields: [{ key: "web", label: "Web del equipo", value: `${meta.baseUrl}${card.teamPath}` }, ...(card.actaPath ? [{ key: "acta", label: "Acta de la última jornada", value: `${meta.baseUrl}${card.actaPath}` }] : [])],
    },
    barcodes: [{ format: "PKBarcodeFormatQR", message: `${meta.baseUrl}/mi-perfil`, messageEncoding: "iso-8859-1" }],
  };
}
let images: Promise<Record<string, Buffer>> | null = null;
function passImages() {
  images ??= Promise.all([readFile(join(process.cwd(), "public", "apple-touch-icon.png")), readFile(join(process.cwd(), "public", "logo-fito.png"))])
    .then(([icon, logo]) => ({ "icon.png": icon, "icon@2x.png": icon, "logo.png": logo, "logo@2x.png": logo }))
    .catch(error => { images = null; throw error; });
  return images;
}
export async function signApplePass(card: WalletCardData, meta: { serial: string; authToken: string; baseUrl: string }, config: AppleConfig): Promise<Buffer> {
  const json = applePassJson(card, { ...meta, passTypeId: config.passTypeId, teamIdentifier: config.teamId });
  const pass = new PKPass({ ...(await passImages()), "pass.json": Buffer.from(JSON.stringify(json)) }, { wwdr: config.wwdr, signerCert: config.cert, signerKey: config.key, ...(config.passphrase ? { signerKeyPassphrase: config.passphrase } : {}) });
  return pass.getAsBuffer();
}

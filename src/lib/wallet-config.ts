// Wallet credentials are server-only and stored as base64 so PEM newlines survive hosting UIs.
type Env = Record<string, string | undefined>;
export type AppleConfig = { passTypeId: string; teamId: string; cert: string; key: string; passphrase?: string; wwdr: string };
export type GoogleConfig = { issuerId: string; clientEmail: string; privateKey: string };
const decode = (value: string) => Buffer.from(value, "base64").toString("utf8");
// Apple stores this URL inside every pass: it must be public, fixed and https.
export function publicBaseUrl(env: Env = process.env): string | null {
  const value = env.PUBLIC_BASE_URL?.trim(); if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.origin : null; } catch { return null; }
}
export function appleConfig(env: Env = process.env): AppleConfig | null {
  const { APPLE_PASS_TYPE_ID: passTypeId, APPLE_TEAM_ID: teamId, APPLE_PASS_CERT: cert, APPLE_PASS_KEY: key, APPLE_WWDR_CERT: wwdr, APPLE_PASS_KEY_PASSPHRASE: passphrase } = env;
  if (!passTypeId || !teamId || !cert || !key || !wwdr || !publicBaseUrl(env)) return null;
  return { passTypeId, teamId, cert: decode(cert), key: decode(key), wwdr: decode(wwdr), ...(passphrase ? { passphrase } : {}) };
}
export function googleConfig(env: Env = process.env): GoogleConfig | null {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID; const raw = env.GOOGLE_WALLET_SA_JSON;
  if (!issuerId || !raw || !publicBaseUrl(env)) return null;
  try {
    const json = JSON.parse(decode(raw));
    return typeof json.client_email === "string" && typeof json.private_key === "string" ? { issuerId, clientEmail: json.client_email, privateKey: json.private_key } : null;
  } catch { return null; }
}
export const walletAvailability = (env: Env = process.env) => ({ apple: appleConfig(env) !== null, google: googleConfig(env) !== null });

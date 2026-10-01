import { load } from "cheerio";
import { authenticateSnp } from "./snp-auth";
// Read only numeric sports identifiers from the authenticated document. Never
// evaluate SNP JavaScript or copy the whole account object into our database.
export function parseSnpAccountIdentity(html: string) {
  const $ = load(html);
  const scripts = $("script").toArray().map(e => $(e).html() ?? "").join("\n");
  function numericField(variable: string, field: string) {
    const object = scripts.match(new RegExp(`\\b${variable}\\s*=\\s*(?:JSON\\.parse\\(|\\$\\.parseJSON\\()?['"]?(\\{[\\s\\S]*?\\})`))?.[1];
    const value = object?.match(new RegExp(`"${field}"\\s*:\\s*"?(\\d{1,10})(?:"|[,}\\s])`))?.[1];
    return value && value !== "0" ? value : null;
  }
  const userId = numericField("userG", "id");
  const playerId = numericField("rankingJugadorNacional", "idjugador");
  if (!userId || !playerId) throw new Error("No se pudo identificar una ficha de jugador en la sesión SNP.");
  return { userId, playerId };
}
export async function identifySnpAccount(email: string, password: string) {
  const access = await authenticateSnp(email, password);
  const response = await access.http(access.frameUrl);
  if (!response.ok) throw new Error("SNP no devolvió la sesión.");
  return parseSnpAccountIdentity(await response.text());
}

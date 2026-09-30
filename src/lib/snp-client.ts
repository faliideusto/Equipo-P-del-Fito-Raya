import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { CookieJar } from "tough-cookie";
import { load } from "cheerio";
import { authenticateSnp,createSnpHttp,isSnpHost } from "./snp-auth";

const ROOT = "https://seriesnacionalesdepadel.snpgalaxy.com";
const allowedHost = isSnpHost;
const sessionPath = () => path.resolve(process.env.SNP_SESSION_FILE || ".snp-private/session.json");
export class SnpAccessError extends Error {}
class SnpClient {
  private stamp = 0;
  private jar = new CookieJar();
  private fetch = createSnpHttp(this.jar);
  private frameUrl = "";
  private chain = "";
  private season = "";
  private loading: Promise<void> | null = null;
  private credentialHash = "";
  private expiresAt = 0;
  private retryAfter = 0;
  async ready() {
    if (this.loading) return this.loading;
    this.loading = this.loadSession();
    try { await this.loading; } finally { this.loading = null; }
  }
  private async loadSession() {
    if(process.env.SNP_EMAIL && process.env.SNP_PASSWORD){
      const hash=createHash("sha256").update(process.env.SNP_EMAIL+"\0"+process.env.SNP_PASSWORD).digest("hex");
      if(hash===this.credentialHash&&Date.now()<this.expiresAt)return;
      if(Date.now()<this.retryAfter)throw new SnpAccessError("SNP no está disponible. Se reintentará la conexión en un minuto.");
      try {
        const access=await authenticateSnp(process.env.SNP_EMAIL,process.env.SNP_PASSWORD);
        this.jar=access.jar;this.fetch=access.http;this.frameUrl=access.frameUrl;this.chain="";this.season="";
        const html=await this.read(this.frameUrl);this.checkHtml(html);this.updateTokens(html);
        this.chain ||= decodeURIComponent(new URL(this.frameUrl).pathname.match(/\/s_:([^/]+)/)?.[1]||"");
        this.credentialHash=hash;this.expiresAt=Date.now()+15*60*1000;this.retryAfter=0;return;
      } catch {this.retryAfter=Date.now()+60000;throw new SnpAccessError("No se pudo iniciar sesión en SNP. Revisa las credenciales privadas o completa cualquier verificación pendiente en SNP.");}
    }
    let stamp: number;
    try { stamp = (await stat(sessionPath())).mtimeMs; } catch { throw new SnpAccessError("Falta la sesión SNP. Abre Conexión SNP e inicia sesión con Google."); }
    if (stamp === this.stamp) return;
    let session;
    try { session = JSON.parse(await readFile(sessionPath(), "utf8")); } catch {throw new SnpAccessError("El archivo de sesión SNP no es válido. Renueva la conexión.");}
    const url = new URL(session.frameUrl);
    if (!allowedHost(url.hostname) || url.protocol !== "https:") throw new SnpAccessError("El archivo de sesión no pertenece a SNP.");
    this.jar = new CookieJar(); this.fetch = createSnpHttp(this.jar);
    for (const cookie of session.cookies ?? []) {
      const domain = String(cookie.domain).replace(/^\./, "");
      if (!allowedHost(domain)) continue;
      const expiry = cookie.expires > 0 ? `; Expires=${new Date(cookie.expires * 1000).toUTCString()}` : "";
      await this.jar.setCookie(`${cookie.name}=${cookie.value}; Domain=${domain}; Path=${cookie.path || "/"}${cookie.secure ? "; Secure" : ""}${expiry}`, `https://${domain}`);
    }
    this.chain = ""; this.season = "";
    this.frameUrl = url.toString();
    const html = await this.read(this.frameUrl);
    this.checkHtml(html);
    this.updateTokens(html);
    this.chain ||= decodeURIComponent(url.pathname.match(/\/s_:([^/]+)/)?.[1] || "");
    this.stamp = stamp;
  }
  private updateTokens(html: string) {
    // Tokens only exist in this server instance and the ignored private session file.
    this.chain = html.match(/(?:var\s+)?chainG\s*=\s*["']([^"']+)["']/)?.[1] || this.chain;
    this.season = html.match(/temporadaG\s*=\s*\{[^;]*?["']?id["']?\s*:\s*["']?(\d+)/)?.[1] || this.season;
  }
  private async read(url: string, init?: RequestInit) {
    let response;
    try {
      response = await this.fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(20000) });
      if([502,503,504].includes(response.status)){
        await new Promise(resolve=>setTimeout(resolve,250));
        response=await this.fetch(url,{...init,cache:"no-store",signal:AbortSignal.timeout(20000)});
      }
    }
    catch {throw new Error("No se pudo contactar con SNP. Se conserva la última consulta disponible.");}
    if (!response.ok) throw new Error(`SNP no respondió correctamente (${response.status}).`);
    if (!allowedHost(new URL(response.url).hostname)) throw new SnpAccessError("SNP solicita renovar la sesión.");
    return response.text();
  }
  private checkHtml(html: string) {
    const $ = load(html);
    if ($("form.form_login,input[type=password]").length || /<title>[^<]*Login/i.test(html)) {this.expiresAt=0;this.stamp=0;throw new SnpAccessError("La sesión SNP ha caducado. Se renovará en la siguiente consulta.");}
  }
  async html(route: string) {
    if (!/^\/(?:competicion\/view\/1|equipo\/view\/\d+|ranking\/menu_puntuacion\/\d+|enfrentamiento\/edit\/\d+\/verG)$/.test(route)) throw new Error("Ruta SNP no permitida.");
    await this.ready();
    const url = ROOT + route + (this.chain ? `/s_:${this.chain}` : "");
    const html = await this.read(url); this.checkHtml(html); this.updateTokens(html); return html;
  }
  async ajax(action: string, values: Record<string,string>, controller = "competicion") {
    const reads:Record<string,string[]> = {competicion:["ajaxGetFasesByZona","ajaxGetFase","ajaxGetCategoriaPadreCompeticion","ajaxGetByCategoriaPadre","ajaxGetClubByFaseGrupo","ajaxGetDivisiones","ajaxGetClasificacion","ajaxAccionesResultadosJornada","ajaxGetResultadosJornada"],ranking:["ajaxGetCategoriaGrupoByJugador","ajaxGetByJugadorAndGrupo"],jugador:["ajaxGetAllJugadores"]};
    if (!reads[controller]?.includes(action)) throw new Error("Consulta SNP no permitida.");
    await this.ready();
    const body = new URLSearchParams({ ...values, ...(this.season ? {idtemporadaG: this.season} : {}) });
    const text = await this.read(`${ROOT}/${controller}/${action}${this.chain ? `/s_:${this.chain}` : ""}`, {method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest"}, body});
    let data: Record<string,unknown>;
    try { data = JSON.parse(text); } catch { throw new SnpAccessError("SNP solicita renovar la sesión o ha cambiado su respuesta."); }
    if (data.error) throw new Error("SNP no pudo completar la consulta.");
    if (Object.keys(data).length <= 1) {this.expiresAt=0;this.stamp=0;throw new SnpAccessError("SNP no devuelve datos con esta sesión. Se renovará en la siguiente consulta.");}
    return data;
  }
}
const runtime = globalThis as typeof globalThis & { fitoSnpClient?: SnpClient };
export const snpClient = runtime.fitoSnpClient instanceof SnpClient ? runtime.fitoSnpClient : (runtime.fitoSnpClient = new SnpClient());
export async function hasSnpSession() { if(process.env.SNP_EMAIL&&process.env.SNP_PASSWORD)return true;try { await stat(sessionPath()); return true; } catch { return false; } }

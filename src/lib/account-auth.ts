import { cookies } from "next/headers";
import { verifyCoachToken } from "./coach-session";

type AuthUser = { id: string; email?: string; role?: "coach" | "player" | "visitor"; app_metadata?: { role?: string }; user_metadata?: { position?: string } };
export function accountIdentity(user: AuthUser): AuthUser {
  // Only server-managed app_metadata can grant the visitor role.
  return { ...user, role: user.app_metadata?.role === "visitor" ? "visitor" : "player" };
}
export type Session = { access_token: string; refresh_token: string; expires_in: number; user: AuthUser };
export const accountCookieOptions = () => ({ httpOnly: true, secure: process.env.RENDER === "true" || process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" });
export class AccountError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function accountConfig() {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || new URL(url).protocol !== "https:") throw new AccountError("El acceso de usuarios aún no está configurado.", 503);
  return { url, key };
}
export async function authRequest(path: string, body?: object, token?: string, method?: string) {
  const { url, key } = accountConfig();
  return fetch(new URL(`/auth/v1/${path}`, url), { method: method ?? (body ? "POST" : "GET"), cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
export async function saveSession(session: Session) {
  const jar = await cookies();
  jar.delete("fito-coach");
  const options = accountCookieOptions();
  jar.set("fito-access", session.access_token, { ...options, maxAge: session.expires_in });
  jar.set("fito-refresh", session.refresh_token, { ...options, maxAge: 30 * 86400 });
}
export async function clearSession() {
  const jar = await cookies(); jar.delete("fito-access"); jar.delete("fito-refresh"); jar.delete("fito-coach");
}
export async function currentAccount(): Promise<AuthUser | null> {
  const jar = await cookies(); const token = jar.get("fito-access")?.value;
  if (await verifyCoachToken(jar.get("fito-coach")?.value)) return { id: "coach", email: "fitoraya", role: "coach" };
  if (token) {
    const response = await authRequest("user", undefined, token);
    if (response.ok) return accountIdentity(await response.json());
    if (response.status !== 401 && response.status !== 403) throw new AccountError("No se pudo comprobar tu sesión. Inténtalo de nuevo.", 503);
  }
  const refresh = jar.get("fito-refresh")?.value;
  if (!refresh) return null;
  const response = await authRequest("token?grant_type=refresh_token", { refresh_token: refresh });
  if (!response.ok) {
    if (response.status >= 500) throw new AccountError("No se pudo renovar tu sesión.", 503);
    await clearSession(); return null;
  }
  const session: Session = await response.json(); await saveSession(session); return accountIdentity(session.user);
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Next's internal request URL can use localhost behind a hosting proxy.
  const host = request.headers.get("host") ?? new URL(request.url).host;
  if (!origin || new URL(origin).host !== host) throw new AccountError("Origen no válido.", 403);
}
// Extra protection in this process; Supabase also applies its own Auth limits.
const attempts = new Map<string, { count: number; expires: number }>();
export function limitAccountAttempts(key: string) {
  const now = Date.now();
  for (const [id, row] of attempts) if (row.expires <= now) attempts.delete(id);
  const row = attempts.get(key) ?? { count: 0, expires: now + 300000 };
  row.count++; attempts.set(key, row);
  if (row.count > 8 || attempts.size > 5000) throw new AccountError("Demasiados intentos. Espera cinco minutos.", 429);
}
export async function accountBody(request: Request) {
  requireSameOrigin(request);
  const text = await request.text();
  if (text.length > 5000) throw new AccountError("Petición demasiado grande.", 413);
  try { return JSON.parse(text) as Record<string, unknown>; } catch { throw new AccountError("Petición no válida."); }
}
export function accountReply(body: object, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } }); }
export function accountFailure(error: unknown) { return accountReply({ error: error instanceof AccountError ? error.message : "No se pudo completar la operación. Comprueba la conexión y la configuración de usuarios." }, error instanceof AccountError ? error.status : 503); }

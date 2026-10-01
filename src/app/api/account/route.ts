import { cookies } from "next/headers";
import { accountBody, accountFailure, accountReply, AccountError, authRequest, clearSession, currentAccount, limitAccountAttempts, saveSession } from "@/lib/account-auth";
import { isPosition, playerLink } from "@/lib/account-profile";
import { identifySnpAccount } from "@/lib/snp-identity";
export const runtime = "nodejs";
export async function GET() {
  try { const user = await currentAccount(); return accountReply({ user: user ? { id: user.id, email: user.email, position: user.user_metadata?.position } : null, link: user ? await playerLink(user.id) : null }); }
  catch (error) { return accountFailure(error); }
}
export async function POST(request: Request) {
  try {
    const body = await accountBody(request);
    if (body.action === "logout") {
      const token = (await cookies()).get("fito-access")?.value;
      try { if (token) await authRequest("logout?scope=local", {}, token); } catch { /* Clear local cookies even when the Auth service is unavailable. */ } finally { await clearSession(); }
      return accountReply({ ok: true });
    }
    if (body.action === "link" || body.action === "unlink" || body.action === "position") {
      const user = await currentAccount(); if (!user) throw new AccountError("Inicia sesión para vincular tu ficha.", 401);
      limitAccountAttempts(`link:${user.id}`);
      if (body.action === "unlink") { await playerLink(user.id, undefined, true); return accountReply({ ok: true }); }
      const position = body.position ?? user.user_metadata?.position;
      if (!isPosition(position)) throw new AccountError("Selecciona derecha, revés o ambos.");
      if (body.action === "position") {
        const previous = await playerLink(user.id); if (!previous) throw new AccountError("Vincula primero tu ficha SNP.");
        const link = await playerLink(user.id, { userId: previous.snp_user_id, playerId: previous.player_id, position });
        return accountReply({ ok: true, link });
      }
      const { email, password } = credentials(body);
      let identity;
      try { identity = await identifySnpAccount(email, password); }
      catch { throw new AccountError("No se pudo vincular SNP. Comprueba tu correo y contraseña propios de SNP. Si aparece una verificación, complétala en SNP. La cuenta debe tener una ficha de jugador."); }
      const link = await playerLink(user.id, { ...identity, position }); return accountReply({ ok: true, link });
    }
    if (body.action !== "login" && body.action !== "signup") throw new AccountError("Acción no válida.");
    const { email, password } = credentials(body);
    limitAccountAttempts(`auth:${email}`);
    if (body.action === "signup" && password.length < 12) throw new AccountError("Usa al menos 12 caracteres para la contraseña de la web.");
    if (body.action === "signup" && !isPosition(body.position)) throw new AccountError("Selecciona tu posición en pista.");
    const path = body.action === "signup" ? `signup?redirect_to=${encodeURIComponent(new URL("/acceso", request.headers.get("origin")!).toString())}` : "token?grant_type=password";
    const response = await authRequest(path, { email, password, ...(body.action === "signup" ? { data: { position: body.position } } : {}) });
    if (!response.ok) {
      if (response.status === 429) throw new AccountError("Espera unos minutos antes de volver a intentarlo.", 429);
      throw new AccountError(body.action === "login" ? "No se pudo entrar. Comprueba tus datos y confirma antes tu correo." : "No se pudo crear la cuenta. Comprueba el correo y los requisitos de contraseña.");
    }
    const result = await response.json();
    if (result.access_token) { await saveSession(result); return accountReply({ ok: true }); }
    return accountReply({ ok: true, confirmation: true });
  } catch (error) { return accountFailure(error); }
}
function credentials(body: Record<string, unknown>) {
  if (typeof body.email !== "string" || typeof body.password !== "string") throw new AccountError("Introduce correo y contraseña.");
  const email = body.email.trim().toLowerCase(); const password = body.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 1 || password.length > 256) throw new AccountError("Introduce un correo y contraseña válidos.");
  return { email, password };
}

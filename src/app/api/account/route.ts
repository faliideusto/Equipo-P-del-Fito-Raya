import { registerLinkedAccount } from "@/lib/account-registration";
import { cookies } from "next/headers";
import { accountBody, accountCookieOptions, accountFailure, accountReply, AccountError, authRequest, clearSession, currentAccount, limitAccountAttempts, saveSession } from "@/lib/account-auth";
import { verifyCoachPassword } from "@/lib/coach-auth";
import { createCoachToken } from "@/lib/coach-session";
import { isPosition, playerLink } from "@/lib/account-profile";
import { requireRosterSelection, rosterPlayer } from "@/lib/account-roster";
export const runtime = "nodejs";
export async function GET() {
  try { const user = await currentAccount(); return accountReply({ user: user ? { id: user.id, email: user.email, role: user.role === "coach" ? "coach" : "player", position: user.user_metadata?.position } : null, link: user && user.role !== "coach" ? await playerLink(user.id) : null }); }
  catch (error) { return accountFailure(error); }
}
export async function POST(request: Request) {
  try {
    const body = await accountBody(request);
    if (body.action === "login" && typeof body.email === "string" && body.email.trim().toLowerCase() === "fitoraya") {
      limitAccountAttempts("coach-login");
      if (!await verifyCoachPassword(body.password)) throw new AccountError("Usuario o contraseña incorrectos.", 401);
      await clearSession();
      (await cookies()).set("fito-coach", await createCoachToken(), { ...accountCookieOptions(), maxAge: 8 * 3600 });
      return accountReply({ ok: true, coach: true });
    }
    if (body.action === "logout") {
      const token = (await cookies()).get("fito-access")?.value;
      try { if (token) await authRequest("logout?scope=local", {}, token); } catch { /* Clear local cookies even when the Auth service is unavailable. */ } finally { await clearSession(); }
      return accountReply({ ok: true });
    }
    if (body.action === "link" || body.action === "unlink" || body.action === "position") {
      const user = await currentAccount(); if (!user) throw new AccountError("Inicia sesión para vincular tu ficha.", 401);
      if (user.role === "coach") throw new AccountError("La cuenta del entrenador no necesita vincular un jugador.");
      limitAccountAttempts(`link:${user.id}`);
      if (body.action === "unlink") { await playerLink(user.id, undefined, true); return accountReply({ ok: true }); }
      const position = body.position ?? user.user_metadata?.position;
      if (!isPosition(position)) throw new AccountError("Selecciona derecha, revés o ambos.");
      if (body.action === "position") {
        const previous = await playerLink(user.id); if (!previous) throw new AccountError("Vincula primero tu ficha SNP.");
        const link = await playerLink(user.id, { userId: previous.snp_user_id, playerId: previous.player_id, position });
        return accountReply({ ok: true, link });
      }
      const { teamId, playerId } = requireRosterSelection(body.teamId, body.playerId);
      await rosterPlayer(teamId, playerId);
      const link = await playerLink(user.id, { userId: null, playerId, position }); return accountReply({ ok: true, link });
    }
    if (body.action !== "login" && body.action !== "signup") throw new AccountError("Acción no válida.");
    const { email, password } = credentials(body);
    limitAccountAttempts(`auth:${email}`);
    if (body.action === "signup" && password.length < 12) throw new AccountError("Usa al menos 12 caracteres para la contraseña de la web.");
    if (body.action === "signup" && !isPosition(body.position)) throw new AccountError("Selecciona tu posición en pista.");
    if (body.action === "signup") {
      const { teamId, playerId } = requireRosterSelection(body.teamId, body.playerId);
      const session = await registerLinkedAccount(email, password, body.position as "LEFT" | "RIGHT" | "BOTH", teamId, playerId);
      await saveSession(session); return accountReply({ ok: true });
    }
    const response = await authRequest("token?grant_type=password", { email, password });
    if (!response.ok) {
      if (response.status === 429) throw new AccountError("Espera unos minutos antes de volver a intentarlo.", 429);
      throw new AccountError(body.action === "login" ? "No se pudo entrar. Comprueba tu correo y contraseña." : "No se pudo crear la cuenta. Comprueba el correo y los requisitos de contraseña.");
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

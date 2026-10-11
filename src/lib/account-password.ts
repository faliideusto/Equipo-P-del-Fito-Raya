import { createHash } from "node:crypto";
import { AccountError, authRequest, type Session } from "./account-auth";

// Supabase enforces its own password policy. A deterministic, fixed-length
// provider credential lets members choose any nonempty web password. Supabase
// still hashes that credential; the original password is never persisted.
export function providerPassword(password: string) {
  return `Fito!9a-${createHash("sha256").update("fito-snp:password:v1\0").update(password, "utf8").digest("hex")}`;
}

export async function signInAccount(email: string, password: string) {
  const response = await authRequest("token?grant_type=password", { email, password: providerPassword(password) });
  // Accounts registered before this change used their password directly.
  if (response.status !== 400) return response;
  return authRequest("token?grant_type=password", { email, password });
}

async function updatePassword(token: string, password: string) {
  const response = await authRequest("user", { password: providerPassword(password) }, token, "PUT");
  if (response.status === 422) throw new AccountError("La nueva contraseña debe ser distinta de la actual.");
  if (response.status === 429) throw new AccountError("Espera unos minutos antes de volver a intentarlo.", 429);
  if (!response.ok) throw new AccountError("No se pudo guardar la nueva contraseña.", 503);
}
async function signInWithNewPassword(email: string, password: string) {
  const signed = await signInAccount(email, password);
  if (!signed.ok) throw new AccountError("Contraseña cambiada. Inicia sesión de nuevo con la nueva contraseña.");
  return await signed.json() as Session;
}
// A fresh sign-in proves the current password and gives a recent session, so
// Supabase's secure password change does not ask for a reauthentication nonce.
export async function changeAccountPassword(email: string, current: string, next: string) {
  const signed = await signInAccount(email, current);
  if (signed.status === 429) throw new AccountError("Espera unos minutos antes de volver a intentarlo.", 429);
  if (!signed.ok) throw new AccountError("La contraseña actual no es correcta.", 401);
  await updatePassword((await signed.json() as Session).access_token, next);
  return signInWithNewPassword(email, next);
}
export async function requestPasswordReset(email: string, redirectTo: string) {
  const response = await authRequest(`recover?redirect_to=${encodeURIComponent(redirectTo)}`, { email });
  // Other failures are not reported, so the reply never reveals whether an email is registered.
  if (response.status === 429) throw new AccountError("Ya se ha enviado un correo hace poco. Espera unos minutos antes de pedir otro.", 429);
  if (response.status >= 500) throw new AccountError("No se pudo enviar el correo. Inténtalo más tarde.", 503);
}
// The recovery link opens /acceso with a short-lived session in the URL fragment.
export async function resetAccountPassword(token: string, next: string) {
  const user = await authRequest("user", undefined, token);
  if (!user.ok) throw new AccountError("El enlace no es válido o ha caducado. Solicita otro.", 401);
  const { email } = await user.json() as { email?: string };
  if (!email) throw new AccountError("El enlace no es válido o ha caducado. Solicita otro.", 401);
  await updatePassword(token, next);
  return signInWithNewPassword(email, next);
}

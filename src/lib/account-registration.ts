import { accountConfig, AccountError, authRequest, type Session } from "./account-auth";
import { providerPassword } from "./account-password";
import { playerLink } from "./account-profile";
import { rosterPlayer } from "./account-roster";
import type { Position, TeamId } from "@/domain/types";

export async function registerLinkedAccount(email: string, password: string, position: Position, teamId: TeamId, playerId: string) {
  await rosterPlayer(teamId, playerId);
  const { key } = accountConfig();
  const adminToken = key.startsWith("eyJ") ? key : undefined;
  // Admin creation rejects existing emails, so rollback can only delete the
  // new account created by this request, never a previously registered member.
  const created = await authRequest("admin/users", { email, password: providerPassword(password), email_confirm: true, user_metadata: { position } }, adminToken);
  if (!created.ok) throw new AccountError("No se pudo crear la cuenta. Si ya tienes una, inicia sesión. Comprueba también el correo.");
  const user = await created.json();
  if (typeof user.id !== "string" || !/^[a-f0-9-]{36}$/i.test(user.id)) throw new AccountError("No se pudo confirmar la creación de la cuenta.", 503);
  try { await playerLink(user.id, { userId: null, playerId, position }); }
  catch (error) {
    const removed = await authRequest(`admin/users/${user.id}`, undefined, adminToken, "DELETE");
    if (!removed.ok) throw new AccountError("No se pudo terminar el registro. Contacta con el entrenador para revisar tu cuenta.", 503);
    throw error;
  }
  const signed = await authRequest("token?grant_type=password", { email, password: providerPassword(password) });
  if (!signed.ok) throw new AccountError("Tu cuenta y ficha SNP se han guardado. Inicia sesión para continuar.");
  return await signed.json() as Session;
}

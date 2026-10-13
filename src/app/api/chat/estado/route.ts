import { AccountError, accountFailure, accountReply, currentAccount } from "@/lib/account-auth";
import { chatHealth } from "@/lib/chat/llm-client";
import { chatIdentity } from "@/lib/chat/identity";
export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await currentAccount();
    if (!user) throw new AccountError("Inicia sesión para usar el asistente.", 401);
    if (user.role !== "player" && user.role !== "coach") return accountReply({ disponible: false, motivo: "El asistente es solo para los jugadores y el entrenador del club." });
    // equipo: where the team selector starts for this user.
    const [health, { team }] = await Promise.all([chatHealth(), chatIdentity(user)]);
    return accountReply({ ...health, equipo: team });
  } catch (error) { return accountFailure(error); }
}

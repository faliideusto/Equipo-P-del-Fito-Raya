import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { coachCredentialRevision } from "./coach-auth";
function signature(payload: string) {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Configura la clave privada del servidor.");
  return createHmac("sha256", key).update(payload).digest("base64url");
}
export async function createCoachToken() {
  const payload = Buffer.from(JSON.stringify({ user: "fitoraya", expires: Date.now() + 8 * 3600000, revision: await coachCredentialRevision() })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export async function verifyCoachToken(token?: string) {
  if (!token || token.length > 1000) return false;
  const [payload, sig, extra] = token.split("."); if (!payload || !sig || extra) return false;
  const expected = Buffer.from(signature(payload)); const provided = Buffer.from(sig);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return false;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    return value.user === "fitoraya" && value.expires > Date.now() && value.revision === await coachCredentialRevision();
  } catch { return false; }
}
export async function isCoachSession() { try { return await verifyCoachToken((await cookies()).get("fito-coach")?.value); } catch { return false; } }

import { createHash } from "node:crypto";
import { authRequest } from "./account-auth";

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

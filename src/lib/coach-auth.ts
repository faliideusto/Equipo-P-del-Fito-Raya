import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
const file = ".club-private/coach-password.json";
type Credential = { salt: string; hash: string };
async function credentialRequest(value?: Credential): Promise<Credential | null> {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SECRET_KEY;
  if (url && key) {
    const endpoint = new URL("/rest/v1/coach_credentials", url);
    if (endpoint.protocol !== "https:") throw new Error("URL no válida");
    endpoint.searchParams.set("id", "eq.coach");
    if (value) endpoint.searchParams.set("on_conflict", "id");
    else endpoint.searchParams.set("select", "salt,hash");
    const response = await fetch(endpoint, { method: value ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, ...(value ? { body: JSON.stringify({ id: "coach", ...value }) } : {}) });
    if (!value && response.status === 404) {
      const error = await response.json();
      if (error.code === "PGRST205" || error.code === "42P01") return null;
    }
    if (!response.ok) throw new Error("No se pudo consultar la contraseña del entrenador. Ejecuta el SQL de coach_credentials en Supabase.");
    return value ?? (await response.json())[0] ?? null;
  }
  if (process.env.RENDER === "true" || url || key) throw new Error("Configura Supabase para conservar la contraseña.");
  if (value) { await mkdir(".club-private", { recursive: true }); const temp = `${file}.${randomBytes(8).toString("hex")}.tmp`; await writeFile(temp, JSON.stringify(value), { mode: 0o600 }); await rename(temp, file); return value; }
  try { return JSON.parse(await readFile(file, "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
}
export async function verifyCoachPassword(password: unknown) {
  if (typeof password !== "string" || password.length > 256) return false;
  const saved = await credentialRequest();
  if (saved) return timingSafeEqual(scryptSync(password, saved.salt, 64), Buffer.from(saved.hash, "hex"));
  const initial = process.env.POSITIONS_ADMIN_PASSWORD;
  return !!initial && timingSafeEqual(createHash("sha256").update(password).digest(), createHash("sha256").update(initial).digest());
}
export async function changeCoachPassword(password: string) {
  const salt = randomBytes(32).toString("hex");
  await credentialRequest({ salt, hash: scryptSync(password, salt, 64).toString("hex") });
}

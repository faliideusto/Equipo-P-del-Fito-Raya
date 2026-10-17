import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// One value per player (position, nickname…): a Supabase table in hosting, a private JSON file locally.
type Options = { table: string; column: string; fileEnv: string; defaultFile: string; label: string };
export function hasPersistentPlayerData() {
  return (process.env.RENDER !== "true" && process.env.VERCEL !== "1") || Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}
export function playerAttributeStore<T>({ table, column, fileEnv, defaultFile, label }: Options) {
  type Values = Record<string, T | null>;
  const file = () => path.resolve(process.env[fileEnv] || defaultFile);
  let pending: Promise<void> = Promise.resolve();
  function database() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url && !key) return null;
    if (!url || !key) throw new Error("Configura las dos variables de Supabase.");
    const endpoint = new URL(`/rest/v1/${table}`, url);
    if (endpoint.protocol !== "https:") throw new Error("Supabase requiere HTTPS.");
    return { endpoint, key };
  }
  async function databaseRequest(method: "GET" | "POST", updates?: Values) {
    const config = database()!;
    if (method === "GET") config.endpoint.searchParams.set("select", `id,${column}`);
    else config.endpoint.searchParams.set("on_conflict", "id");
    const response = await fetch(config.endpoint, {
      method, cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { apikey: config.key, ...(config.key.startsWith("eyJ") ? { Authorization: `Bearer ${config.key}` } : {}), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      ...(updates ? { body: JSON.stringify(Object.entries(updates).map(([id, value]) => ({ id, [column]: value }))) } : {}),
    });
    if (!response.ok) throw new Error(`No se pudo acceder al almacenamiento de ${label}.`);
    if (method === "GET") {
      const rows: Record<string, T | null>[] = await response.json();
      return Object.fromEntries(rows.map(row => [row.id, row[column]])) as Values;
    }
    return {};
  }
  async function read(): Promise<Values> {
    if (database()) return databaseRequest("GET");
    try { return JSON.parse(await readFile(file(), "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}; throw error; }
  }
  async function save(updates: Values): Promise<void> {
    if (!hasPersistentPlayerData()) throw new Error(`Configura Supabase para conservar las ${label} en el alojamiento.`);
    if (database()) { await databaseRequest("POST", updates); return; }
    const operation = pending.then(async () => {
      const next = { ...await read(), ...updates };
      await mkdir(path.dirname(file()), { recursive: true });
      const temporary = `${file()}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
      await rename(temporary, file());
    });
    pending = operation.catch(() => {});
    return operation;
  }
  return { read, save };
}

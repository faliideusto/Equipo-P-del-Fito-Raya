import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Position } from "@/domain/types";

type Positions = Record<string, Position | null>;
const file = () => path.resolve(process.env.PLAYER_POSITIONS_FILE || ".club-private/positions.json");
let pending: Promise<void> = Promise.resolve();
export function hasPersistentPositions() {
  return process.env.RENDER !== "true" || Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}
function database() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url && !key) return null;
  if (!url || !key) throw new Error("Configura las dos variables de Supabase.");
  const endpoint = new URL("/rest/v1/player_positions", url);
  if (endpoint.protocol !== "https:") throw new Error("Supabase requiere HTTPS.");
  return { endpoint, key };
}
async function databaseRequest(method: "GET" | "POST", updates?: Positions) {
  const config = database()!;
  if (method === "GET") config.endpoint.searchParams.set("select", "id,position");
  else config.endpoint.searchParams.set("on_conflict", "id");
  const response = await fetch(config.endpoint, {
    method, cache: "no-store", signal: AbortSignal.timeout(15000),
    headers: { apikey: config.key, ...(config.key.startsWith("eyJ") ? { Authorization: `Bearer ${config.key}` } : {}), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    ...(updates ? { body: JSON.stringify(Object.entries(updates).map(([id, position]) => ({ id, position }))) } : {}),
  });
  if (!response.ok) throw new Error("No se pudo acceder al almacenamiento de posiciones.");
  if (method === "GET") {
    const rows: { id: string; position: Position | null }[] = await response.json();
    return Object.fromEntries(rows.map(row => [row.id, row.position])) as Positions;
  }
  return {};
}
export async function readPositions(): Promise<Positions> {
  if (database()) return databaseRequest("GET");
  try { return JSON.parse(await readFile(file(), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}; throw error; }
}
export async function savePositions(updates: Positions): Promise<void> {
  if (!hasPersistentPositions()) throw new Error("Configura Supabase para conservar las posiciones en Render gratuito.");
  if (database()) { await databaseRequest("POST", updates); return; }
  const operation = pending.then(async () => {
    const next = { ...await readPositions(), ...updates };
    await mkdir(path.dirname(file()), { recursive: true });
    const temporary = `${file()}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
    await rename(temporary, file());
  });
  pending = operation.catch(() => {});
  return operation;
}

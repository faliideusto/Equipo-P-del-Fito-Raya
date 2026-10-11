import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { TeamId } from "@/domain/types";
import type { SetScore } from "@/domain/match-result";
export type MatchResultRow = { fixture_id: string; team_id: TeamId; pair_index: number; sets: SetScore[]; player_id: string; submitted_by: string; created_at: string };
// pair_index is set for "already_reported" so a coach delete can re-prompt exactly that pair.
export type MatchAbsenceRow = { user_id: string; fixture_id: string; reason: "absent" | "already_reported"; pair_index: number | null; created_at: string };
export class DuplicateResultError extends Error {}
const RESULT_FIELDS = "fixture_id,team_id,pair_index,sets,player_id,submitted_by,created_at";
let pending: Promise<void> = Promise.resolve();
function supabase() {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SECRET_KEY;
  if (url && key) return { url, key };
  if (process.env.RENDER === "true" || process.env.VERCEL === "1" || url || key) throw new Error("Configura Supabase para conservar los resultados.");
  return null;
}
async function rest(table: string, method: string, params: Record<string, string>, body?: object, prefer = "return=minimal") {
  const { url, key } = supabase()!;
  const endpoint = new URL(`/rest/v1/${table}`, url);
  if (endpoint.protocol !== "https:") throw new Error("URL no válida");
  for (const [k, v] of Object.entries(params)) endpoint.searchParams.set(k, v);
  const response = await fetch(endpoint, { method, cache: "no-store", signal: AbortSignal.timeout(15000), headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", Prefer: prefer }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (response.status === 409) throw new DuplicateResultError("Este resultado ya lo ha registrado otro jugador.");
  if (!response.ok) throw new Error(`No se pudo acceder a ${table}. Ejecuta supabase/match-results.sql si falta la tabla.`);
  return method === "GET" ? response.json() : null;
}
async function readFileRows<T>(file: string): Promise<T[]> { try { return JSON.parse(await readFile(file, "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; } }
async function updateFile<T>(file: string, change: (rows: T[]) => T[]) {
  const operation = pending.then(async () => { const next = change(await readFileRows<T>(file)); await mkdir(".club-private", { recursive: true }); const tmp = `${file}.${randomUUID()}.tmp`; await writeFile(tmp, JSON.stringify(next), { mode: 0o600 }); await rename(tmp, file); });
  pending = operation.catch(() => {}); await operation;
}
const RESULTS_FILE = ".club-private/match-results.json"; const ABSENCES_FILE = ".club-private/match-absences.json";
const sameKey = (a: Pick<MatchResultRow, "fixture_id" | "team_id" | "pair_index">, b: typeof a) => a.fixture_id === b.fixture_id && a.team_id === b.team_id && a.pair_index === b.pair_index;
export async function listResults(fixtureIds: string[]): Promise<MatchResultRow[]> {
  const ids = fixtureIds.filter(id => /^\d{1,10}$/.test(id)); if (!ids.length) return [];
  if (supabase()) return rest("match_results", "GET", { select: RESULT_FIELDS, fixture_id: `in.(${ids.join(",")})`, order: "fixture_id.asc,team_id.asc,pair_index.asc" });
  return (await readFileRows<MatchResultRow>(RESULTS_FILE)).filter(row => ids.includes(row.fixture_id));
}
export async function listAbsences(userId: string): Promise<MatchAbsenceRow[]> {
  if (supabase()) return rest("match_absences", "GET", { select: "user_id,fixture_id,reason,pair_index,created_at", user_id: `eq.${userId}` });
  return (await readFileRows<MatchAbsenceRow>(ABSENCES_FILE)).filter(row => row.user_id === userId);
}
export async function saveResult(row: MatchResultRow) {
  if (supabase()) { await rest("match_results", "POST", {}, row); return; }
  let duplicate = false;
  await updateFile<MatchResultRow>(RESULTS_FILE, rows => { duplicate = rows.some(r => sameKey(r, row)); return duplicate ? rows : [...rows, row]; });
  if (duplicate) throw new DuplicateResultError("Este resultado ya lo ha registrado otro jugador.");
}
export async function saveAbsence(row: MatchAbsenceRow) {
  if (supabase()) { await rest("match_absences", "POST", { on_conflict: "user_id,fixture_id" }, row, "resolution=ignore-duplicates,return=minimal"); return; }
  await updateFile<MatchAbsenceRow>(ABSENCES_FILE, rows => rows.some(r => r.user_id === row.user_id && r.fixture_id === row.fixture_id) ? rows : [...rows, row]);
}
export async function deleteResult(fixtureId: string, teamId: TeamId, pairIndex: number) {
  if (supabase()) {
    await rest("match_results", "DELETE", { fixture_id: `eq.${fixtureId}`, team_id: `eq.${teamId}`, pair_index: `eq.${pairIndex}` });
    await rest("match_absences", "DELETE", { fixture_id: `eq.${fixtureId}`, reason: "eq.already_reported", pair_index: `eq.${pairIndex}` });
    return;
  }
  await updateFile<MatchResultRow>(RESULTS_FILE, rows => rows.filter(r => !sameKey(r, { fixture_id: fixtureId, team_id: teamId, pair_index: pairIndex })));
  await updateFile<MatchAbsenceRow>(ABSENCES_FILE, rows => rows.filter(r => !(r.fixture_id === fixtureId && r.reason === "already_reported" && r.pair_index === pairIndex)));
}
// Edit = delete + insert with the existing grants (no UPDATE). Unlike deleteResult,
// partner confirmations stay: the pair still has a result.
export async function replaceResult(row: MatchResultRow) {
  if (supabase()) {
    await rest("match_results", "DELETE", { fixture_id: `eq.${row.fixture_id}`, team_id: `eq.${row.team_id}`, pair_index: `eq.${row.pair_index}` });
    await rest("match_results", "POST", {}, row);
    return;
  }
  await updateFile<MatchResultRow>(RESULTS_FILE, rows => [...rows.filter(r => !sameKey(r, row)), row]);
}

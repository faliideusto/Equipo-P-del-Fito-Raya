import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { SnpResult } from "@/domain/snp";
export const cacheFolder = () => process.env.VERCEL === "1" ? path.join(tmpdir(), "fito-snp-cache") : path.resolve(process.env.SNP_CACHE_DIR || ".snp-cache");
const folder = cacheFolder();
const pending = new Map<string,Promise<SnpResult<unknown>>>();
let latestSuccess: string | null = null;
let latestError: string | null = null;
export const cacheStatus = () => ({ lastSuccess: latestSuccess, error: latestError });
// Next's shared cache answers with an expired copy while it refreshes in the background, however
// old: an acta opened before the match came back without its sets. An expired copy is read again
// from SNP, and only kept if SNP fails.
export async function unexpired<T>(shared: SnpResult<T>, ttl: number, live: () => Promise<SnpResult<T>>): Promise<SnpResult<T>> {
  return Date.now() - Date.parse(shared.updatedAt) < ttl && !outdated(shared) ? shared : live().catch(() => shared);
}
// Manual refresh: every copy saved before that moment is read again from SNP the next time a page
// asks for it, so the button also updates the acta or the player being viewed, not only the
// teams and the standings.
const SHARED_TAG = "fito-snp";
let refreshedAt = 0;
const outdated = (copy: SnpResult<unknown>) => Date.parse(copy.updatedAt) < refreshedAt;
export async function expireSnpCache(now = Date.now()) {
  refreshedAt = now;
  if (process.env.VERCEL === "1") try { (await import("next/cache")).revalidateTag(SHARED_TAG, { expire: 0 }); } catch { /* Outside a request there is no shared cache to expire. */ }
}
export async function cachedSnp<T>(key: string, loader: () => Promise<T>, fallback?: T, force = false): Promise<SnpResult<T>> {
  if (!/^[a-z0-9-]+$/.test(key)) throw new Error("Consulta no válida.");
  const running = pending.get(key); if (running) return running as Promise<SnpResult<T>>;
  const operation = (async (): Promise<SnpResult<T>> => {
    const file = path.join(folder, key + ".json");
    let cached: SnpResult<T> | undefined;
    try { cached = JSON.parse(await readFile(file,"utf8")); } catch { /* No usable cache yet. */ }
    const ttl = Math.max(30, Math.min(3600, Number(process.env.SNP_CACHE_SECONDS) || 60)) * 1000;
    if (!force && cached && !outdated(cached) && Date.now() - Date.parse(cached.updatedAt) < ttl) return {...cached,source: "cache" as const,stale:false,changed:false};
    try {
      const loadResult = async (): Promise<SnpResult<T>> => ({ data: await loader(), updatedAt: new Date().toISOString(), source: "live", stale: false });
      // Keep the existing rendering model; Next's Data Cache is shared on Vercel.
      // Only successful SNP responses enter this cache, never session cookies.
      const result = process.env.VERCEL === "1" && !force && !(cached && outdated(cached))
        ? await unexpired(await (await import("next/cache")).unstable_cache(loadResult, ["fito-snp-v1", key], { revalidate: ttl / 1000, tags: [SHARED_TAG] })(), ttl, loadResult)
        : await loadResult();
      const temporary = file + "." + randomUUID() + ".tmp";
      try {
        await mkdir(folder,{recursive:true});
        await writeFile(temporary,JSON.stringify(result),{mode:0o600}); await rename(temporary,file);
      } catch { /* A cache write failure must never discard a successful SNP response. */ }
      latestSuccess = result.updatedAt; latestError = null;
      const changed = !cached || JSON.stringify(cached.data) !== JSON.stringify(result.data);
      return { ...result, source: Date.now() - Date.parse(result.updatedAt) > 1000 ? "cache" : "live", stale: false, changed };
    } catch(error) {
      const message = error instanceof Error ? error.message : "No se pudo consultar SNP.";
      latestError = message;
      if (cached) return {...cached,source:"cache" as const,stale:true,error:message,changed:false};
      if (fallback !== undefined) return {data:fallback,updatedAt:"2026-09-30T00:00:00+02:00",source:"snapshot" as const,stale:true,error:message,changed:false};
      throw error;
    }
  })();
  pending.set(key,operation);
  try { return await operation; } finally { pending.delete(key); }
}

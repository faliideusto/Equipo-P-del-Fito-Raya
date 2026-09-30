import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import type { SnpResult } from "@/domain/snp";
const folder = path.resolve(process.env.SNP_CACHE_DIR || ".snp-cache");
const pending = new Map<string,Promise<SnpResult<unknown>>>();
let latestSuccess: string | null = null;
let latestError: string | null = null;
export const cacheStatus = () => ({ lastSuccess: latestSuccess, error: latestError });
export async function cachedSnp<T>(key: string, loader: () => Promise<T>, fallback?: T, force = false): Promise<SnpResult<T>> {
  if (!/^[a-z0-9-]+$/.test(key)) throw new Error("Consulta no válida.");
  const running = pending.get(key); if (running) return running as Promise<SnpResult<T>>;
  const operation = (async () => {
    const file = path.join(folder, key + ".json");
    let cached: SnpResult<T> | undefined;
    try { cached = JSON.parse(await readFile(file,"utf8")); } catch { /* No usable cache yet. */ }
    const ttl = Math.max(30, Math.min(3600, Number(process.env.SNP_CACHE_SECONDS) || 60)) * 1000;
    if (!force && cached && Date.now() - Date.parse(cached.updatedAt) < ttl) return {...cached,source: "cache" as const,stale:false};
    try {
      const data = await loader();
      const result: SnpResult<T> = { data, updatedAt: new Date().toISOString(), source: "live", stale:false };
      await mkdir(folder,{recursive:true});
      await writeFile(file + ".tmp",JSON.stringify(result)); await rename(file + ".tmp",file);
      latestSuccess = result.updatedAt; latestError = null;
      return result;
    } catch(error) {
      const message = error instanceof Error ? error.message : "No se pudo consultar SNP.";
      latestError = message;
      if (cached) return {...cached,source:"cache" as const,stale:true,error:message};
      if (fallback !== undefined) return {data:fallback,updatedAt:"2026-09-30T00:00:00+02:00",source:"snapshot" as const,stale:true,error:message};
      throw error;
    }
  })();
  pending.set(key,operation);
  try { return await operation; } finally { pending.delete(key); }
}

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("la caché indica si SNP ha devuelto datos distintos a los guardados", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fito-cache-changes-"));
  const previous = process.env.SNP_CACHE_DIR;
  process.env.SNP_CACHE_DIR = directory;
  try {
    const { cachedSnp } = await import("../src/lib/snp-cache");
    assert.equal((await cachedSnp("changes", async () => ({ score: null }), undefined, true)).changed, true, "primera consulta: datos nuevos");
    assert.equal((await cachedSnp("changes", async () => ({ score: null }), undefined, true)).changed, false, "mismos datos");
    assert.equal((await cachedSnp("changes", async () => ({ score: [10, 2] }), undefined, true)).changed, true, "SNP publica un resultado");
    assert.equal((await cachedSnp("changes", async () => ({ score: [0, 0] }))).changed, false, "dentro del TTL se sirve la caché sin consultar");
    assert.equal((await cachedSnp("changes-error", async () => { throw new Error("SNP unavailable"); }, { score: null })).changed, false, "un fallo no es un cambio");
  } finally {
    if (previous === undefined) delete process.env.SNP_CACHE_DIR; else process.env.SNP_CACHE_DIR = previous;
    await rm(directory, { recursive: true });
  }
});

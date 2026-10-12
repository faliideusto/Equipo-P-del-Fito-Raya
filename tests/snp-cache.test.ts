import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("a failed cache write preserves live SNP data and source errors still use the snapshot", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fito-cache-test-"));
  const previous = process.env.SNP_CACHE_DIR;
  const blocked = path.join(directory, "not-a-directory");
  await writeFile(blocked, "blocked");
  process.env.SNP_CACHE_DIR = blocked;
  try {
    const { cachedSnp } = await import("../src/lib/snp-cache");
    const live = await cachedSnp("live-test", async () => ({ points: 12 }), { points: 0 });
    assert.deepEqual(live.data, { points: 12 });
    assert.equal(live.source, "live");
    assert.equal(live.stale, false);
    const fallback = await cachedSnp("error-test", async () => { throw new Error("SNP unavailable"); }, { points: 0 });
    assert.deepEqual(fallback.data, { points: 0 });
    assert.equal(fallback.source, "snapshot");
    assert.equal(fallback.stale, true);
    await assert.rejects(cachedSnp("no-fallback", async () => { throw new Error("SNP unavailable"); }), /SNP unavailable/);
  } finally {
    if (previous === undefined) delete process.env.SNP_CACHE_DIR;
    else process.env.SNP_CACHE_DIR = previous;
    await rm(directory, { recursive: true });
  }
});

test("an expired copy of the shared cache is read again from SNP", async () => {
  const { unexpired } = await import("../src/lib/snp-cache");
  const copy = (data: { sets: number[][] }, age: number) => ({ data, updatedAt: new Date(Date.now() - age).toISOString(), source: "live" as const, stale: false });
  const before = copy({ sets: [] }, 3_600_000); const after = copy({ sets: [[6, 3]] }, 0);
  assert.deepEqual((await unexpired(before, 60_000, async () => after)).data, { sets: [[6, 3]] });
  assert.equal(await unexpired(before, 60_000, async () => { throw new Error("SNP unavailable"); }), before);
  const recent = copy({ sets: [] }, 5_000);
  assert.equal(await unexpired(recent, 60_000, async () => after), recent);
});

test("a manual refresh makes every saved copy be read again from SNP once", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fito-cache-test-"));
  const previous = process.env.SNP_CACHE_DIR;
  process.env.SNP_CACHE_DIR = directory;
  try {
    // A fresh copy of the module, so it uses this test's folder.
    const fresh = "../src/lib/snp-cache?manual-refresh";
    const { cachedSnp, expireSnpCache } = await import(fresh) as typeof import("../src/lib/snp-cache");
    let reads = 0; const acta = () => cachedSnp("match-refresh-test", async () => ({ reads: ++reads }));
    await acta(); assert.equal((await acta()).data.reads, 1, "within the cache time the saved copy is used");
    await new Promise(resolve => setTimeout(resolve, 5));
    await expireSnpCache();
    assert.equal((await acta()).data.reads, 2); assert.equal((await acta()).data.reads, 2, "the new copy is cached again");
  } finally {
    if (previous === undefined) delete process.env.SNP_CACHE_DIR; else process.env.SNP_CACHE_DIR = previous;
    await rm(directory, { recursive: true });
  }
});

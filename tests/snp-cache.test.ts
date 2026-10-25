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
    const { cachedSnp, expireSnpCache } = await import("../src/lib/snp-cache");
    await expireSnpCache(0);
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

test("a confirmed copy is kept beyond the cache time until its signature changes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fito-cache-test-"));
  const previous = process.env.SNP_CACHE_DIR;
  process.env.SNP_CACHE_DIR = directory;
  try {
    const { cachedSnp, expireSnpCache } = await import("../src/lib/snp-cache");
    // A refresh from an earlier test would make the aged copies look outdated.
    await expireSnpCache(0);
    const { readFile } = await import("node:fs/promises");
    let score = "10-2"; let reads = 0;
    const acta = (signature?: string) => cachedSnp("match-kept-test", async () => ({ score, reads: ++reads }), undefined, false,
      signature ? { signature, seconds: 86400, valid: data => data.score === signature } : undefined);
    // An hour later, well past the cache time.
    const age = async () => { const file = path.join(directory, "match-kept-test.json"); const copy = JSON.parse(await readFile(file, "utf8")); copy.updatedAt = new Date(Date.now() - 3_600_000).toISOString(); await writeFile(file, JSON.stringify(copy)); };
    assert.equal((await acta("10-2")).data.reads, 1); await age();
    assert.equal((await acta("10-2")).data.reads, 1, "confirmed and unchanged: SNP is not asked again");
    assert.equal((await acta()).data.reads, 2, "without a result in the calendar the usual cache time applies");
    await age(); score = "9-3";
    assert.equal((await acta("9-3")).data.reads, 3, "the calendar result changed: read again");
    await age(); score = "0-0";
    assert.equal((await acta("12-0")).data.reads, 4); await age();
    assert.equal((await acta("12-0")).data.reads, 5, "a read that does not match the calendar is never kept");
    score = "12-0"; await age(); await acta("12-0"); await age();
    await expireSnpCache();
    assert.equal((await acta("12-0")).data.reads, 7, "the refresh button reads kept copies again");
  } finally {
    if (previous === undefined) delete process.env.SNP_CACHE_DIR; else process.env.SNP_CACHE_DIR = previous;
    await rm(directory, { recursive: true });
  }
});

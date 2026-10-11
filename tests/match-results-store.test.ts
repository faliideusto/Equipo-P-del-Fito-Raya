import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DuplicateResultError, deleteResult, listAbsences, listResults, replaceResult, saveAbsence, saveResult } from "../src/lib/match-results";

test("guarda resultados y ausencias en archivo privado sin Supabase", async () => {
  const saved = { cwd: process.cwd(), url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, render: process.env.RENDER, vercel: process.env.VERCEL };
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SECRET_KEY; delete process.env.RENDER; delete process.env.VERCEL;
  const dir = await mkdtemp(path.join(tmpdir(), "fito-results-"));
  process.chdir(dir);
  try {
    const row = { fixture_id: "55", team_id: "a" as const, pair_index: 2, sets: [[6, 4], [6, 3]] as [number, number][], player_id: "10", submitted_by: "u1", created_at: "2026-10-10T14:00:00.000Z" };
    await saveResult(row);
    await assert.rejects(saveResult({ ...row, submitted_by: "u2" }), DuplicateResultError);
    assert.deepEqual(await listResults(["55"]), [row]);
    assert.deepEqual(await listResults(["99"]), []);
    await saveAbsence({ user_id: "u1", fixture_id: "55", reason: "absent", pair_index: null, created_at: row.created_at });
    await saveAbsence({ user_id: "u1", fixture_id: "55", reason: "absent", pair_index: null, created_at: row.created_at });
    assert.equal((await listAbsences("u1")).length, 1);
    assert.equal((await listAbsences("u2")).length, 0);
    await deleteResult("55", "a", 2);
    assert.deepEqual(await listResults(["55"]), []);
  } finally {
    process.chdir(saved.cwd); await rm(dir, { recursive: true, force: true });
    for (const [k, v] of [["SUPABASE_URL", saved.url], ["SUPABASE_SECRET_KEY", saved.key], ["RENDER", saved.render], ["VERCEL", saved.vercel]] as const) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});
test("borrar un resultado vuelve a pedirlo a quien confirmó esa pareja, sin tocar otras", async () => {
  const saved = { cwd: process.cwd(), url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY };
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SECRET_KEY;
  const dir = await mkdtemp(path.join(tmpdir(), "fito-results-"));
  process.chdir(dir);
  try {
    const at = "2026-10-10T14:00:00.000Z";
    await saveResult({ fixture_id: "55", team_id: "a", pair_index: 2, sets: [[6, 4], [6, 3]], player_id: "10", submitted_by: "u1", created_at: at });
    await saveAbsence({ user_id: "u2", fixture_id: "55", reason: "already_reported", pair_index: 2, created_at: at });
    await saveAbsence({ user_id: "u3", fixture_id: "55", reason: "already_reported", pair_index: 4, created_at: at });
    await saveAbsence({ user_id: "u4", fixture_id: "55", reason: "absent", pair_index: null, created_at: at });
    await deleteResult("55", "a", 2);
    assert.equal((await listAbsences("u2")).length, 0);
    assert.equal((await listAbsences("u3")).length, 1);
    assert.equal((await listAbsences("u4")).length, 1);
  } finally {
    process.chdir(saved.cwd); await rm(dir, { recursive: true, force: true });
    if (saved.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = saved.key;
  }
});
test("modificar un resultado cambia sets y autor sin borrar las confirmaciones de la pareja", async () => {
  const saved = { cwd: process.cwd(), url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY };
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SECRET_KEY;
  const dir = await mkdtemp(path.join(tmpdir(), "fito-results-"));
  process.chdir(dir);
  try {
    const at = "2026-10-10T14:00:00.000Z";
    await saveResult({ fixture_id: "55", team_id: "a", pair_index: 2, sets: [[6, 4], [6, 3]], player_id: "10", submitted_by: "u1", created_at: at });
    await saveResult({ fixture_id: "55", team_id: "a", pair_index: 3, sets: [[1, 6], [2, 6]], player_id: "20", submitted_by: "u3", created_at: at });
    await saveAbsence({ user_id: "u2", fixture_id: "55", reason: "already_reported", pair_index: 2, created_at: at });
    await replaceResult({ fixture_id: "55", team_id: "a", pair_index: 2, sets: [[4, 6], [6, 3], [10, 8]], player_id: "11", submitted_by: "u2", created_at: "2026-10-10T15:00:00.000Z" });
    const rows = await listResults(["55"]);
    assert.equal(rows.length, 2);
    const edited = rows.find(r => r.pair_index === 2)!;
    assert.deepEqual(edited.sets, [[4, 6], [6, 3], [10, 8]]); assert.equal(edited.submitted_by, "u2");
    assert.deepEqual(rows.find(r => r.pair_index === 3)!.sets, [[1, 6], [2, 6]]);
    assert.equal((await listAbsences("u2")).length, 1);
  } finally {
    process.chdir(saved.cwd); await rm(dir, { recursive: true, force: true });
    if (saved.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = saved.key;
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("Mi perfil and the team view return the same zonal rank for the linked player", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fito-profile-test-"));
  const oldCache = process.env.SNP_CACHE_DIR; process.env.SNP_CACHE_DIR = directory;
  const { snpClient } = await import("../src/lib/snp-client");
  const oldHtml = snpClient.html; const oldAjax = snpClient.ajax;
  snpClient.html = async route => route.startsWith("/equipo/") ? "<h3>Jugadores de Equipo A</h3>" : '<input name="texto_jugador" value="Jugador fixture">';
  let failOtherGroup = false;
  snpClient.ajax = async (action, values) => {
    if (action === "ajaxGetAllJugadores") return { entities: [{ id: "381423", nombre: "Jugador", apellidos: "fixture", rankings: [] }], num_resultados: 1 };
    if (action === "ajaxGetCategoriaGrupoByJugador") return { grupos_select: [{ id: "20", nombre: "Future" }, { id: "19", nombre: "500" }] };
    if (values.idgrupo === "19") {
      if (failOtherGroup) throw new Error("SNP unavailable");
      return { entity: { puntos: 10000, orden: 2000 }, datos: { regular: { J: { 1: { pd: 1, p3p_p2s: 1 } } } }, datos_ant: [] };
    }
    return { entity: { puntos: 58007.81, orden: 1896 }, datos: { regular: { J: { 1: { pd: 1, p2p_g2s: 1 } } } }, datos_ant: { regular: { J: { 1: { pd: 1, p2p_g3s: 1 } } } } };
  };
  try {
    // Provide the exact roster shape that contains both national and zonal ranks.
    const { normalizeTeamPlayer } = await import("../src/lib/snp-team");
    // The fixture is cached at the source boundary to isolate the context behavior.
    const { cachedSnp } = await import("../src/lib/snp-cache");
    const player = { ...normalizeTeamPlayer({ id: "381423", nombre: "Jugador", apellidos: "fixture" }), points: 58007.81, nationalRank: "1896", zoneRank: "198" };
    await cachedSnp("team-7778", async () => ({ id: "7778", name: "Equipo A", players: [player] }));
    const { getSnpPlayer } = await import("../src/lib/snp-service");
    const profile = await getSnpPlayer("381423", undefined, undefined, true);
    const teamView = await getSnpPlayer("381423", "7778", undefined, true);
    assert.equal(profile.data.zoneRank, "198");
    assert.equal(profile.data.zoneRank, teamView.data.zoneRank);
    assert.equal(profile.data.nationalRank, teamView.data.nationalRank);
    assert.deepEqual(profile.data.winRates?.current, { won: 1, lost: 1, decided: 2, percentage: 50, setsWon: 2, setsLost: 2 });
    assert.ok(Math.abs(profile.data.winRates!.total.percentage! - 200 / 3) < 1e-10);
    const otherGroup = await getSnpPlayer("381423", "7778", "19", true);
    assert.deepEqual(otherGroup.data.winRates, profile.data.winRates);
    assert.equal(otherGroup.data.stats[0].lost, 1);
    // Unchanged data reuses the stored winrate without asking SNP for the other groups.
    failOtherGroup = true;
    await unlink(path.join(directory, "player-v4-381423-7778-default.json"));
    const reused = await getSnpPlayer("381423", "7778", undefined);
    assert.deepEqual(reused.data.winRates, profile.data.winRates);
    const incomplete = await getSnpPlayer("381423", "7778", undefined, true);
    assert.equal(incomplete.data.stats[0].won, 1);
    assert.equal(incomplete.data.winRates, undefined);
    assert.match(incomplete.data.winRatesError!, /todos los grupos/);
  } finally {
    snpClient.html = oldHtml; snpClient.ajax = oldAjax;
    if (oldCache === undefined) delete process.env.SNP_CACHE_DIR; else process.env.SNP_CACHE_DIR = oldCache;
    for (const file of await readdir(directory)) await unlink(path.join(directory, file));
    await rmdir(directory);
  }
});

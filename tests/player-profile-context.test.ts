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
  snpClient.ajax = async action => {
    if (action === "ajaxGetAllJugadores") return { entities: [{ id: "381423", nombre: "Jugador", apellidos: "fixture", rankings: [] }], num_resultados: 1 };
    if (action === "ajaxGetCategoriaGrupoByJugador") return { grupos_select: [{ id: "20", nombre: "Future" }] };
    return { entity: { puntos: 58007.81, orden: 1896 }, datos: [], datos_ant: [] };
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
  } finally {
    snpClient.html = oldHtml; snpClient.ajax = oldAjax;
    if (oldCache === undefined) delete process.env.SNP_CACHE_DIR; else process.env.SNP_CACHE_DIR = oldCache;
    for (const file of await readdir(directory)) await unlink(path.join(directory, file));
    await rmdir(directory);
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { actaCoefficient, actaForecast, divisionCoefficient, gameResultPoints, teamBonus } from "../src/domain/snp-points";
import type { SetScore } from "../src/domain/match-result";
test("coeficiente por división", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(divisionCoefficient), [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.74, 0.73, 0.72, 0.71]);
  assert.equal(divisionCoefficient(40), 0.5);
  assert.equal(actaCoefficient("Enfrentamiento (#55252): SNP ESPAÑA - FASE REGULAR CÁDIZ - MASCULINO - Future - 2ª División"), 0.95);
  assert.equal(actaCoefficient("Enfrentamiento: FASE PLAYOFF ZONAL CADIZ - 3ª División"), 1);
  assert.equal(actaCoefficient("Jornada 2"), null);
  assert.deepEqual(actaForecast("Jornada 2", [[[6, 1], [6, 2]]]), [[null, null]]);
});
test("puntos por resultado y valor del partido", () => {
  const win2: SetScore[] = [[6, 2], [6, 3]]; const win3: SetScore[] = [[6, 2], [3, 6], [6, 1]];
  assert.deepEqual([gameResultPoints(0, win2, 0), gameResultPoints(0, win3, 0), gameResultPoints(0, win3, 1), gameResultPoints(0, win2, 1)], [7, 6, 4, 3]);
  assert.deepEqual([gameResultPoints(4, win2, 0), gameResultPoints(4, win3, 0), gameResultPoints(4, win3, 1), gameResultPoints(4, win2, 1)], [5, 4, 2, 1]);
  assert.equal(gameResultPoints(2, [[6, 2]], 0), null);
});
test("casos reales del acta 55262 (2ª, Fito gana 10-2) y 55252 (6-6)", () => {
  const w: SetScore[] = [[6, 1], [6, 2]]; const l: SetScore[] = [[1, 6], [2, 6]]; const w3: SetScore[] = [[6, 1], [2, 6], [6, 2]];
  const title = "FASE REGULAR CÁDIZ - MASCULINO - Future - 2ª División";
  const forecast = actaForecast(title, [w, w, w3, w, l]);
  assert.deepEqual(forecast.map(f => f[0]?.points), [7.6, 7.6, 4.75, 5.7, 1.9]);
  assert.equal(teamBonus([w, w, l, l, l], 0), 0.5);
  assert.equal(teamBonus([w, l, w3, l, w], 0), 1);
  assert.equal(actaForecast(title, [[[6, 1], [3, 6], [1, 6]], w, w3, null, null])[0][0]?.withBonus, false);
});
test("previsión del ranking con un historial real de SNP (J2 en 2ª, +7,6)", async () => {
  const { rankingForecast } = await import("../src/domain/snp-points");
  const history = JSON.parse((await import("node:fs")).readFileSync(new URL("./snp-ranking-history.fixture.json", import.meta.url), "utf8"));
  const title = "Enfrentamiento (#55262): SNP ESPAÑA - FASE REGULAR CÁDIZ - MASCULINO - Future - 2ª División [Jornada 2]";
  // Ya publicada por SNP: se muestra el dato real.
  assert.deepEqual(rankingForecast(history, title, 2, 7.6), { before: 58007.81, after: 64101.56, published: true });
  // Antes de publicarla: se quita la J2 y se calcula con la fórmula.
  const pending = structuredClone(history); delete pending.current["269"].J["2"]; pending.current["269"].j_a = "1";
  assert.deepEqual(rankingForecast(pending, title, 2, 7.6), { before: 58007.81, after: 64101.56, published: false });
  // Jornada abierta por SNP con el acta sin confirmar: la fila existe sin partido. Se prevé desde el ranking actual.
  const open = { current: { "269": { nombre: "FASE REGULAR CÁDIZ", j_a: "2", J: { "1": { ptos_c: 6.65, pd: 1, puntos: 51062.5 }, "2": { ptos_c: 0, puntos: 46015.63 } } } }, previous: { "269": { nombre: "FASE REGULAR CÁDIZ", j_a: "10", J: { "2": { ptos_c: 5.7, pd: 1 }, "4": { ptos_c: 3.325, pd: 1 }, "6": { ptos_c: 3.8, pd: 1 }, "7": { ptos_c: 0.95, pd: 1 } } } } };
  assert.deepEqual(rankingForecast(open, title, 2, 2.85, 46015.63), { before: 46015.63, after: 43937.5, published: false });
});

test("publicado por SNP, la variación parte de los puntos de la convocatoria, como la previsión", async () => {
  const { rankingForecast } = await import("../src/domain/snp-points");
  const title = "Enfrentamiento (#55260): SNP ESPAÑA - FASE REGULAR CÁDIZ - MASCULINO - Future - 2ª División [Jornada 2]";
  const history = { current: { "269": { nombre: "FASE REGULAR CÁDIZ", j_a: "2", J: { "1": { ptos_c: 6.65, pd: 1, puntos: 51062.5 }, "2": { ptos_c: 2.85, pd: 1, puntos: 43937.5 } } } }, previous: {} };
  // 46.015,63 PTS −2.078 → 43.938, no −7.125 desde el ranking de la jornada 1.
  assert.deepEqual(rankingForecast(history, title, 2, 2.85, 46015.63), { before: 46015.63, after: 43937.5, published: true });
});

import test from "node:test";
import assert from "node:assert/strict";
import { actaGames, changedPairs, lineupFromPoints } from "../src/domain/snp-lineup-points";

const game = (numero: number, extra: Record<string, unknown> | null, home = "100", away = "200") =>
  ({ id: String(numero), numero: String(numero), idequipo1: home, idequipo2: away, datos_extra: extra === null ? null : JSON.stringify(extra), Incidencia: [] });
const page = (games: object[]) => `<script>var x = 1;\n var partidos_json = ${JSON.stringify(games, null, 2)};\n var otra = [1];</script>`;

test("lee partidos_json del acta, con los puntos de datos_extra", () => {
  const games = actaGames(page([game(1, { pr_j3: "56875", pr_j4: "50312.5" }), game(2, null)]));
  assert.deepEqual(games, [
    { numero: 1, homeId: "100", awayId: "200", extra: { pr_j3: "56875", pr_j4: "50312.5" } },
    { numero: 2, homeId: "100", awayId: "200", extra: {} },
  ]);
  assert.deepEqual(actaGames("<html>sin datos</html>"), []);
  assert.deepEqual(actaGames("var partidos_json = [{roto"), []);
});

test("el rival visitante sale de pr_j3/pr_j4 y el local de pr_j1/pr_j2", () => {
  const roster = [{ id: "a", points: 56875 }, { id: "b", points: 50312.5 }, { id: "c", points: 41562.5 }, { id: "d", points: 0 }];
  const away = lineupFromPoints([game(1, { pr_j3: "56875", pr_j4: "50312.5", pr_j1: "41562.5" })].map(g => actaGames(page([g]))[0]), "200", roster);
  assert.equal(away.status, "found");
  assert.deepEqual(away.pairs[0].players, ["a", "b"]);
  const home = lineupFromPoints(actaGames(page([game(5, { pr_j1: "41562.5", pr_j2: 0 })])), "100", roster);
  assert.deepEqual(home.pairs[4].players, ["c", "d"]);
  assert.deepEqual(home.ties, []);
});

test("sin puntos del rival en el acta, no hay alineación", () => {
  const games = actaGames(page([game(1, null), game(2, { pr_j1: "5000" })]));
  assert.equal(lineupFromPoints(games, "200", [{ id: "a", points: 5000 }]).status, "none");
});

test("con puntos repetidos coloca uno, lista los demás y nunca repite jugador", () => {
  const roster = [{ id: "x", points: 32812.5 }, { id: "y", points: 32812.5 }, { id: "u", points: 67812.5 }];
  const result = lineupFromPoints(actaGames(page([game(1, { pr_j3: "67812.5", pr_j4: "32812.5" }), game(3, { pr_j3: "32812.5", pr_j4: "32812.5" })])), "200", roster);
  const placed = result.pairs.flatMap(pair => pair.players).filter(Boolean);
  assert.equal(new Set(placed).size, placed.length);
  assert.deepEqual(result.pairs[0].players, ["u", "x"]);
  assert.deepEqual(result.pairs[2].players, ["y", null]);
  assert.deepEqual(result.ties.map(tie => [tie.pair, tie.slot, tie.candidates]), [[1, 1, ["x", "y"]], [3, 0, ["x", "y"]]]);
  assert.deepEqual(result.missing, [{ pair: 3, slot: 1, points: 32812.5 }]);
});

test("una puntuación única no se la queda antes un hueco con empate", () => {
  // "z" only fits its own score; the tie must not take it.
  const roster = [{ id: "z", points: 100 }, { id: "w", points: 100 }, { id: "solo", points: 200 }];
  const result = lineupFromPoints(actaGames(page([game(1, { pr_j3: "100", pr_j4: "200" }), game(2, { pr_j3: "100" })])), "200", roster);
  assert.deepEqual(result.missing, []);
  assert.equal(result.pairs[0].players[1], "solo");
});

test("avisa de las parejas cambiadas, sin contar un empate de puntos como cambio", () => {
  const roster = [{ id: "u", points: 67812.5 }, { id: "x", points: 32812.5 }, { id: "y", points: 32812.5 }, { id: "v", points: 1000 }, { id: "w", points: 2000 }, { id: "old", points: 500 }];
  const snp = lineupFromPoints(actaGames(page([game(1, { pr_j3: "67812.5", pr_j4: "32812.5" }), game(2, { pr_j3: "1000", pr_j4: "2000" }), game(3, { pr_j3: "9999" })])), "200", roster);
  const saved = (pairs: [string | null, string | null][]) => pairs.map((players, i) => ({ id: `slot-${i}`, players }));
  // P1 with the other tied player, P2 in the other order, P3 with points nobody has: no change.
  assert.deepEqual(changedPairs(snp, saved([["y", "u"], ["w", "v"], ["old", null], [null, null], [null, null]])), []);
  // P2 now has another player; P4 has no points in SNP, so anyone saved there still fits.
  assert.deepEqual(changedPairs(snp, saved([["u", "x"], ["v", "old"], [null, null], ["old", null], [null, null]])), [2]);
  // A slot SNP filled but the saved lineup left empty is a change.
  assert.deepEqual(changedPairs(snp, saved([["u", null], ["v", "w"], [null, null], [null, null], [null, null]])), [1]);
  assert.deepEqual(changedPairs(lineupFromPoints([], "200", roster), saved([["u", "x"], [null, null], [null, null], [null, null], [null, null]])), []);
});

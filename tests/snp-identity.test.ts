import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSnpAccountIdentity } from "../src/lib/snp-identity";
test("links the authenticated sports identity, never another profile or account fields", () => {
  const html = `<input value="999999"><script>var userG = {"id":162797,"email":"private@example.invalid","role":"user"}; var rankingJugadorNacional = {"id":198879,"idjugador":381423,"datos":{"extra":1}};</script><a href="/ranking/menu_puntuacion/999999">Other player</a>`;
  assert.deepEqual(parseSnpAccountIdentity(html), { userId: "162797", playerId: "381423" });
});
test("fails closed on missing, null, zero or changed identity fields", () => {
  for (const value of ['null','0','"not-a-player"']) assert.throws(() => parseSnpAccountIdentity(`<script>var userG={"id":12}; var rankingJugadorNacional={"idjugador":${value}};</script>`));
  assert.throws(() => parseSnpAccountIdentity('<script>var userG={"id":12}; var other={"idjugador":381423};</script>'));
});
test("supports SNP's JSON literal assignment without executing scripts", () => {
  assert.deepEqual(parseSnpAccountIdentity(`<script>var userG='{"id":162797,"role":"user"}'; var rankingJugadorNacional='{"id":198879,"idjugador":381423,"datos":{"phase":1}}';</script>`), { userId: "162797", playerId: "381423" });
});
test("supports assignments without semicolons and nested ranking data", () => {
  assert.deepEqual(parseSnpAccountIdentity(`<script>var userG = {"id":162797}
var rankingJugadorNacional = {"id":198879,"idjugador":381423,"datos":{"phase":1}}
</script>`), { userId: "162797", playerId: "381423" });
});

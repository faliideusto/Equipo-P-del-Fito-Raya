import test from "node:test";
import assert from "node:assert/strict";
import { canCheckLineups } from "../src/domain/cayitos";
import { canSeeLineupCheck } from "../src/lib/cayitos";
import { actaIdFrom } from "../src/domain/acta-id";

test("solo la cuenta de Rafael abre el comprobador de alineaciones", async () => {
  assert.ok(canCheckLineups("381423"));
  assert.ok(!canCheckLineups("397865") && !canCheckLineups(null));
  const link = async () => ({ player_id: "381423" });
  assert.equal(await canSeeLineupCheck({ account: async () => ({ id: "u", role: "player" }), link }), true);
  assert.equal(await canSeeLineupCheck({ account: async () => ({ id: "u", role: "player" }), link: async () => ({ player_id: "397865" }) }), false);
  assert.equal(await canSeeLineupCheck({ account: async () => ({ id: "t", role: "cayito" }), link }), false);
  assert.equal(await canSeeLineupCheck({ account: async () => ({ id: "c", role: "coach" }), link }), false);
  assert.equal(await canSeeLineupCheck({ account: async () => null, link }), false);
  assert.equal(await canSeeLineupCheck({ account: async () => { throw new Error("caído"); }, link }), false);
});

test("reconoce el acta por número o por enlace de SNP", () => {
  assert.equal(actaIdFrom(" 54705 "), "54705");
  assert.equal(actaIdFrom("https://seriesnacionalesdepadel.snpgalaxy.com/enfrentamiento/edit/54705/verG"), "54705");
  assert.equal(actaIdFrom("https://x/enfrentamiento/view/12"), "12");
  assert.equal(actaIdFrom("hola"), null);
  assert.equal(actaIdFrom(""), null);
  assert.equal(actaIdFrom(undefined), null);
});

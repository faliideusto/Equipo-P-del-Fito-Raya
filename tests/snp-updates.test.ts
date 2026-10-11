import test from "node:test";
import assert from "node:assert/strict";
import { isForcedCheck, snpCheckEvent } from "../src/lib/snp-updates";

test("el aviso de comprobación distingue la actualización manual de la automática", () => {
  assert.equal(isForcedCheck(snpCheckEvent(true)), true);
  assert.equal(isForcedCheck(snpCheckEvent(false)), false);
  assert.equal(isForcedCheck(new Event("fito:snp-checked")), false);
  assert.equal(snpCheckEvent(true).type, "fito:snp-checked");
});

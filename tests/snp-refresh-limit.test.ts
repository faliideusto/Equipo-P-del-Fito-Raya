import test from "node:test";
import assert from "node:assert/strict";
import { allowForcedRefresh, FORCED_REFRESH_MS } from "../src/lib/snp-refresh-limit";

test("una consulta forzada a SNP se permite como mucho cada 30 segundos por clave", () => {
  assert.equal(FORCED_REFRESH_MS, 30 * 1000);
  assert.equal(allowForcedRefresh("sync", 1000), true);
  assert.equal(allowForcedRefresh("sync", 1000 + FORCED_REFRESH_MS - 1), false);
  assert.equal(allowForcedRefresh("competition:2318", 2000), true, "otra clave no se bloquea");
  assert.equal(allowForcedRefresh("sync", 1000 + FORCED_REFRESH_MS), true);
});

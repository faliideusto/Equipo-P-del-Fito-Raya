import { test } from "node:test";
import assert from "node:assert/strict";
import { accountIdentity } from "../src/lib/account-auth";

test("visitor role comes only from server-managed metadata", () => {
  assert.equal(accountIdentity({ id: "fixture", app_metadata: { role: "visitor" } }).role, "visitor");
  assert.equal(accountIdentity({ id: "fixture", role: "visitor" }).role, "player");
  assert.equal(accountIdentity({ id: "fixture", role: "coach" }).role, "player");
  assert.equal(accountIdentity({ id: "fixture", app_metadata: { role: "coach" } }).role, "player");
});

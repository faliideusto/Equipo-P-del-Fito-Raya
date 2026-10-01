import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/lineups/route";

test("Private lineup API rejects requests without authentication or from another origin", async () => {
  const previous = process.env.POSITIONS_ADMIN_PASSWORD;
  process.env.POSITIONS_ADMIN_PASSWORD = "test-only-secret";
  try {
    const request = (origin: string, body: object) => new Request("http://localhost/api/lineups", { method: "POST", headers: { origin, host: "localhost", "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const wrongOrigin = await POST(request("http://example.com", { password: "test-only-secret", action: "list", teamId: "a" }));
    assert.equal(wrongOrigin.status, 403);
    const unauthenticated = await POST(request("http://localhost", { action: "list", teamId: "a" }));
    assert.equal(unauthenticated.status, 401);
    assert.equal((await unauthenticated.json()).lineups, undefined);
    const passwordWithoutSession = await POST(request("http://localhost", { password: "test-only-secret", action: "list", teamId: "c" }));
    assert.equal(passwordWithoutSession.status, 401);
  } finally { if (previous === undefined) delete process.env.POSITIONS_ADMIN_PASSWORD; else process.env.POSITIONS_ADMIN_PASSWORD = previous; }
});

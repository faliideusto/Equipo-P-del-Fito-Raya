import test from "node:test";
import assert from "node:assert/strict";
import { pushOutcome, pushToDevices } from "../src/lib/wallet-apns";

test("clasifica las respuestas de APNs", () => {
  assert.equal(pushOutcome({ status: 200 }), "ok");
  assert.equal(pushOutcome({ status: 410, reason: "Unregistered" }), "unregistered");
  assert.equal(pushOutcome({ status: 400, reason: "BadDeviceToken" }), "unregistered");
  assert.equal(pushOutcome({ status: 400, reason: "BadTopic" }), "failed");
  assert.equal(pushOutcome({ status: 0 }), "failed");
});
test("un envío por token, sin duplicados, y un error no corta el resto", async () => {
  const sent: string[] = [];
  const result = await pushToDevices(["a", "b", "a", "c"], async token => {
    sent.push(token);
    if (token === "b") throw new Error("socket");
    return { status: token === "c" ? 410 : 200 };
  });
  assert.deepEqual(sent, ["a", "b", "c"]);
  assert.deepEqual([...result], [["a", "ok"], ["b", "failed"], ["c", "unregistered"]]);
});

import { connect } from "node:http2";
import type { AppleConfig } from "./wallet-config";
export type PushOutcome = "ok" | "unregistered" | "failed";
export type PushSender = (token: string) => Promise<{ status: number; reason?: string }>;
// 410 and BadDeviceToken mean the pass was removed from that device: forget the token.
export function pushOutcome({ status, reason }: { status: number; reason?: string }): PushOutcome {
  if (status === 200) return "ok";
  if (status === 410 || (status === 400 && reason === "BadDeviceToken")) return "unregistered";
  return "failed";
}
export async function pushToDevices(tokens: string[], send: PushSender): Promise<Map<string, PushOutcome>> {
  const unique = [...new Set(tokens)];
  const results = await Promise.allSettled(unique.map(token => send(token)));
  return new Map(unique.map((token, i) => { const result = results[i]; return [token, result.status === "fulfilled" ? pushOutcome(result.value) : "failed"]; }));
}
// Wallet passes use an empty payload; the device then asks our web service what changed.
export async function withApns<T>(config: AppleConfig, run: (send: PushSender) => Promise<T>): Promise<T> {
  const session = connect("https://api.push.apple.com", { cert: config.cert, key: config.key, ...(config.passphrase ? { passphrase: config.passphrase } : {}) });
  session.on("error", () => { /* Each request reports its own failure. */ });
  const send: PushSender = token => new Promise(resolve => {
    let status = 0; let body = "";
    const request = session.request({ ":method": "POST", ":path": `/3/device/${token}`, "apns-topic": config.passTypeId, "content-type": "application/json" });
    request.setTimeout(10000, () => request.close());
    request.on("response", headers => { status = Number(headers[":status"]); });
    request.setEncoding("utf8");
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => { let reason: string | undefined; try { reason = JSON.parse(body).reason; } catch { reason = undefined; } resolve({ status, reason }); });
    request.on("error", () => resolve({ status: 0 }));
    request.end("{}");
  });
  try { return await run(send); } finally { session.close(); }
}

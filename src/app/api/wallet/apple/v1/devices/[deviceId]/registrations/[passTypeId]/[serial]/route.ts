import { appleConfig } from "@/lib/wallet-config";
import { walletStore } from "@/lib/wallet-store";
import { registerDevice, unregisterDevice } from "@/lib/wallet-apple-service";
export const runtime = "nodejs";
type Context = { params: Promise<{ deviceId: string; passTypeId: string; serial: string }> };
export async function POST(request: Request, { params }: Context) {
  const config = appleConfig(); if (!config) return new Response(null, { status: 404 });
  const { deviceId, passTypeId, serial } = await params;
  const text = await request.text(); let pushToken: unknown = null;
  if (text.length <= 1000) { try { pushToken = JSON.parse(text).pushToken; } catch { pushToken = null; } }
  try { return new Response(null, { status: await registerDevice(walletStore(), { deviceId, passTypeId, expectedType: config.passTypeId, serial, authorization: request.headers.get("authorization"), pushToken }) }); }
  catch { return new Response(null, { status: 503 }); }
}
export async function DELETE(request: Request, { params }: Context) {
  const config = appleConfig(); if (!config) return new Response(null, { status: 404 });
  const { deviceId, passTypeId, serial } = await params;
  try { return new Response(null, { status: await unregisterDevice(walletStore(), { deviceId, passTypeId, expectedType: config.passTypeId, serial, authorization: request.headers.get("authorization") }) }); }
  catch { return new Response(null, { status: 503 }); }
}

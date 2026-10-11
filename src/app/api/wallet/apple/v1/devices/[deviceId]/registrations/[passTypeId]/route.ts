import { appleConfig } from "@/lib/wallet-config";
import { walletStore } from "@/lib/wallet-store";
import { updatedSerials } from "@/lib/wallet-apple-service";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ deviceId: string; passTypeId: string }> }) {
  const config = appleConfig(); if (!config) return new Response(null, { status: 404 });
  const { deviceId, passTypeId } = await params;
  try {
    const result = await updatedSerials(walletStore(), { deviceId, passTypeId, expectedType: config.passTypeId, since: new URL(request.url).searchParams.get("passesUpdatedSince") });
    return result.status === 200 ? Response.json(result.body, { headers: { "Cache-Control": "no-store" } }) : new Response(null, { status: result.status });
  } catch { return new Response(null, { status: 503 }); }
}

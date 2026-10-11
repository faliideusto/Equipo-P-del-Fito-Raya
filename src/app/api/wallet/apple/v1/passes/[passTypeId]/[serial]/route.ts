import { appleConfig } from "@/lib/wallet-config";
import { walletStore } from "@/lib/wallet-store";
import { authorizedPass } from "@/lib/wallet-apple-service";
import { applePassBuffer } from "@/lib/wallet-issue";
export const runtime = "nodejs";
// Always rebuilt from current data; 404 if the player left the roster (Wallet keeps the old pass).
export async function GET(request: Request, { params }: { params: Promise<{ passTypeId: string; serial: string }> }) {
  const config = appleConfig(); if (!config) return new Response(null, { status: 404 });
  const { passTypeId, serial } = await params;
  try {
    const store = walletStore();
    const pass = await authorizedPass(store, { passTypeId, expectedType: config.passTypeId, serial, authorization: request.headers.get("authorization") });
    if (!pass) return new Response(null, { status: 401 });
    const buffer = await applePassBuffer(pass, store);
    if (!buffer) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.apple.pkpass", "Last-Modified": new Date(pass.updated_at).toUTCString(), "Cache-Control": "no-store" } });
  } catch { return new Response(null, { status: 503 }); }
}

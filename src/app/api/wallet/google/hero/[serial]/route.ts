import { googleConfig } from "@/lib/wallet-config";
import { walletStore } from "@/lib/wallet-store";
import { validSerial } from "@/lib/wallet-apple-service";
import { googleHeroImage } from "@/lib/wallet-issue";
export const runtime = "nodejs";
// Hero image of a Google Wallet card. Google downloads it without a session; the URL changes when the drawing does.
export async function GET(_request: Request, { params }: { params: Promise<{ serial: string }> }) {
  if (!googleConfig()) return new Response(null, { status: 404 });
  const { serial } = await params;
  if (!validSerial(serial)) return new Response(null, { status: 404 });
  try {
    const store = walletStore();
    const pass = await store.passBySerial(serial); if (!pass) return new Response(null, { status: 404 });
    const image = await googleHeroImage(pass, store);
    if (!image) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(image), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" } });
  } catch { return new Response(null, { status: 503 }); }
}

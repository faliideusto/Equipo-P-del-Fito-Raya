import { appleConfig } from "@/lib/wallet-config";
export const runtime = "nodejs";
// Wallet reports web service problems here; keep them in the server log for debugging.
export async function POST(request: Request) {
  if (!appleConfig()) return new Response(null, { status: 404 });
  const text = await request.text();
  if (text.length <= 10000) { try { console.warn("[wallet] Apple:", JSON.parse(text).logs); } catch { /* Ignore malformed reports. */ } }
  return new Response(null, { status: 200 });
}

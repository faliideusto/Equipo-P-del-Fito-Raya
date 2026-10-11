"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { announceSnpCheck } from "@/lib/snp-updates";
// Discreet manual refresh for every page. The server limits forced SNP reads to one every
// 30 s; within that window it answers from the cache, so repeated clicks are harmless.
export function RefreshDataButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    try { await fetch("/api/snp/sync?refresh=1", { method: "POST" }); } catch { /* Keep the cached data. */ }
    router.refresh(); announceSnpCheck(true); setBusy(false);
  }
  return <button type="button" className={`refresh-data ${busy ? "is-busy" : ""}`} onClick={() => void refresh()} disabled={busy} aria-label="Actualizar datos de SNP" title="Actualizar datos de SNP"><RefreshCw size={15} aria-hidden/></button>;
}

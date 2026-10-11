"use client";
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { notifySummaryText } from "@/domain/wallet-ui";
import type { TeamId } from "@/domain/types";
type Options = { lineups: { id: string; name: string }[]; publishedLineupId: string | null };
// Coach or captain: publish the next fixture's lineup or announce the last result in Wallet.
export function WalletNotify({ teamId, fixtureId, kind }: { teamId: TeamId; fixtureId: string; kind: "lineup" | "result" }) {
  const [options, setOptions] = useState<Options | null>(null); const [lineupId, setLineupId] = useState("");
  const [busy, setBusy] = useState(false); const [status, setStatus] = useState(""); const [error, setError] = useState("");
  useEffect(() => {
    if (kind !== "lineup") return;
    const controller = new AbortController();
    void fetch(`/api/wallet/notify?teamId=${teamId}`, { signal: controller.signal, cache: "no-store" })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setOptions(data); const ids: string[] = data.lineups.map((l: { id: string }) => l.id); setLineupId(ids.includes(data.publishedLineupId) ? data.publishedLineupId : ids[0] ?? ""); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "No se pudieron cargar las alineaciones."); });
    return () => controller.abort();
  }, [kind, teamId]);
  async function send() {
    if (!window.confirm(kind === "lineup" ? "¿Publicar esta convocatoria y avisar al equipo en Wallet?" : "¿Avisar al equipo del resultado en Wallet?")) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const response = await fetch("/api/wallet/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId, kind, fixtureId, ...(kind === "lineup" ? { lineupId } : {}) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setStatus(notifySummaryText(data.summary));
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo avisar al equipo."); }
    finally { setBusy(false); }
  }
  return <section className="panel wallet-panel">
    <div className="panel-heading"><h2><BellRing size={18} aria-hidden/> Avisar en Wallet</h2></div>
    {kind === "lineup" && options?.lineups.length === 0 && <p className="data-note">Guarda primero una alineación en «Preparar parejas».</p>}
    {kind === "lineup" && !!options?.lineups.length && <label className="wallet-field">Alineación<select value={lineupId} onChange={e => setLineupId(e.target.value)}>{options.lineups.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
    <button type="button" className="button" disabled={busy || (kind === "lineup" && !lineupId)} onClick={() => void send()}>{busy ? "Avisando…" : kind === "lineup" ? "Publicar convocatoria y notificar" : "Notificar resultado"}</button>
    {status && <p className="account-message" role="status">{status}</p>}
    {error && <p className="snp-warning" role="alert">{error}</p>}
  </section>;
}

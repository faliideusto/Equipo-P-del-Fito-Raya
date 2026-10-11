"use client";
import { useState } from "react";
import { BellRing, Send } from "lucide-react";
import { notifySummaryText } from "@/domain/wallet-ui";
import type { Pair, Player, TeamId } from "@/domain/types";
import { LineupBuilder } from "./lineup/lineup-builder";
// Coach or captain: build the next fixture's lineup right here and publish it, or announce the last result in Wallet.
export function WalletNotify({ teamId, fixtureId, kind, round, players, publishedPairs }: { teamId: TeamId; fixtureId: string; kind: "lineup" | "result"; round: number; players: Player[]; publishedPairs: Pair[] | null }) {
  const [busy, setBusy] = useState(false); const [status, setStatus] = useState(""); const [error, setError] = useState("");
  const [published, setPublished] = useState(publishedPairs !== null);
  async function send(pairs?: Pair[]) {
    if (!window.confirm(kind === "lineup" ? (published ? "Ya hay una convocatoria publicada. ¿Sustituirla por esta y avisar al equipo?" : "¿Publicar esta convocatoria y avisar al equipo en Wallet?") : "¿Avisar al equipo del resultado en Wallet?")) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const response = await fetch("/api/wallet/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId, kind, fixtureId, ...(pairs ? { pairs: pairs.map(p => ({ id: p.id, players: p.players })) } : {}) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setStatus(notifySummaryText(data.summary)); if (kind === "lineup") setPublished(true);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo avisar al equipo."); }
    finally { setBusy(false); }
  }
  const messages = <>{status && <p className="wallet-result ok" role="status">{status}</p>}{error && <p className="wallet-result error" role="alert">{error}</p>}</>;
  if (kind === "result") return <section className="panel wallet-panel">
    <div className="panel-heading"><h2><BellRing size={18} aria-hidden/> Resultado de la jornada {round}</h2></div>
    <div className="wallet-body"><div className="wallet-send"><p>Actualiza la tarjeta de Wallet de cada jugador con el marcador final y envía el aviso al móvil.</p><button type="button" className="button" disabled={busy} onClick={() => void send()}><Send size={16} aria-hidden/>{busy ? "Avisando…" : "Notificar resultado"}</button>{messages}</div></div>
  </section>;
  return <section className="panel wallet-panel" id="convocatoria">
    <div className="panel-heading"><h2><BellRing size={18} aria-hidden/> Convocatoria de la jornada {round}</h2>{published && <span className="badge blue">PUBLICADA</span>}</div>
    <div className="wallet-body">
      <p className="wallet-intro">Marca quién está disponible, forma las parejas y pulsa el botón. Cada jugador verá su pareja en la tarjeta de Wallet y recibirá un aviso en el móvil.{published ? " Abajo tienes la convocatoria publicada: si la cambias y vuelves a avisar, sustituye a la anterior." : ""}</p>
      <LineupBuilder key={`${teamId}-${fixtureId}`} players={players} teamId={teamId} initialPairs={publishedPairs ?? undefined} actions={pairs => <div className="wallet-send">
        <p>Se envía la alineación tal como está arriba, sin guardarla ni ponerle nombre. Los jugadores que no estén en ninguna pareja verán «No convocado».</p>
        <button type="button" className="button" disabled={busy || !pairs.some(p => p.players.some(Boolean))} onClick={() => void send(pairs)}><Send size={16} aria-hidden/>{busy ? "Avisando…" : published ? "Actualizar convocatoria y notificar" : "Publicar convocatoria y notificar"}</button>
        {messages}
      </div>}/>
    </div>
  </section>;
}

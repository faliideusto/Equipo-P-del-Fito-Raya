"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Send } from "lucide-react";
import { notifySummaryText } from "@/domain/wallet-ui";
import { buildLineupMessage, whatsappShareUrl } from "@/domain/team-result-message";
import type { Pair, Player, TeamId } from "@/domain/types";
import { LineupBuilder } from "./lineup/lineup-builder";
import { WhatsAppIcon } from "./team-result-share";
type Match = { round: number; opponent: string; date: string; home: boolean; venue?: string | null };
// Coach or captain: build the next fixture's lineup right here, publish it in Wallet and share it on WhatsApp.
export function WalletNotify({ teamId, fixtureId, match, players, publishedPairs, availability }: { teamId: TeamId; fixtureId: string; match: Match; players: Player[]; publishedPairs: Pair[] | null; availability: string[] }) {
  const [busy, setBusy] = useState(false); const [status, setStatus] = useState(""); const [error, setError] = useState("");
  const [published, setPublished] = useState(publishedPairs !== null);
  // The list of available players is saved for this fixture a moment after each change.
  const [saved, setSaved] = useState<"" | "saving" | "saved" | string>(""); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const saveAvailability = useCallback((playerIds: string[]) => {
    if (timer.current) clearTimeout(timer.current);
    setSaved("saving");
    timer.current = setTimeout(() => {
      void fetch("/api/wallet/availability", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId, fixtureId, playerIds }) })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error); setSaved("saved"); })
        .catch(e => setSaved(e instanceof Error && e.message ? e.message : "No se pudo guardar la lista de disponibles."));
    }, 700);
  }, [teamId, fixtureId]);
  async function send(pairs: Pair[]) {
    if (!window.confirm(published ? "Ya hay una convocatoria publicada. ¿Sustituirla por esta y avisar al equipo?" : "¿Publicar esta convocatoria y avisar al equipo en Wallet?")) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const response = await fetch("/api/wallet/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId, kind: "lineup", fixtureId, pairs: pairs.map(p => ({ id: p.id, players: p.players })) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setStatus(notifySummaryText(data.summary)); setPublished(true);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo avisar al equipo."); }
    finally { setBusy(false); }
  }
  return <section className="panel wallet-panel" id="convocatoria">
    <div className="panel-heading"><h2><BellRing size={18} aria-hidden/> Convocatoria de la jornada {match.round}</h2>{published && <span className="badge blue">PUBLICADA</span>}</div>
    <div className="wallet-body">
      <p className="wallet-intro">Marca quién se ha apuntado, forma las parejas y avisa al equipo. La lista de disponibles se guarda sola para esta jornada y la comparten el entrenador y los capitanes. Cada jugador verá su pareja en la tarjeta de Wallet y recibirá un aviso en el móvil.{published ? " Abajo tienes la convocatoria publicada: si la cambias y vuelves a avisar, sustituye a la anterior." : ""}</p>
      {saved && <p className={`wallet-saved ${saved === "saving" || saved === "saved" ? "" : "error"}`} role="status">{saved === "saving" ? "Guardando la lista de disponibles…" : saved === "saved" ? "✓ Lista de disponibles guardada para esta jornada." : saved}</p>}
      <LineupBuilder key={`${teamId}-${fixtureId}`} players={players} teamId={teamId} initialPairs={publishedPairs ?? undefined} initialSelected={availability} onSelectedChange={saveAvailability} actions={pairs => {
        const empty = !pairs.some(p => p.players.some(Boolean));
        return <div className="wallet-send">
          <p>Se envía la alineación tal como está arriba, sin guardarla ni ponerle nombre. En Wallet, los jugadores que no estén en ninguna pareja verán «No convocado».</p>
          <div className="wallet-send-actions">
            {empty ? <span className="button whatsapp" aria-disabled="true"><WhatsAppIcon size={18}/>Enviar por WhatsApp</span> : <a className="button whatsapp" href={whatsappShareUrl(buildLineupMessage({ ...match, teamId, pairs, players }))} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={18}/>Enviar por WhatsApp</a>}
            <button type="button" className="button" disabled={busy || empty} onClick={() => void send(pairs)}><Send size={16} aria-hidden/>{busy ? "Avisando…" : published ? "Actualizar convocatoria y notificar" : "Publicar convocatoria y notificar"}</button>
          </div>
          {status && <p className="wallet-result ok" role="status">{status}</p>}{error && <p className="wallet-result error" role="alert">{error}</p>}
        </div>;
      }}/>
    </div>
  </section>;
}

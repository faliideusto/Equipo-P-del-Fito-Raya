"use client";
import { useState } from "react";
import type { Player, TeamId } from "@/domain/types";
import { PlayerAvatar } from "@/components/player-avatar";
import { cardPhoto } from "@/data/player-photos";
import { MAX_NICKNAME } from "@/domain/team-result-message";
// Coach and captains of the team: the server checks it again on save.
export function NicknameEditor({ players, teamId, onSaved }: { players: Player[]; teamId: TeamId; onSaved: (players: Player[]) => void }) {
  const [draft, setDraft] = useState(players);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit() {
    setBusy(true); setMessage("");
    try {
      const saved = draft.map(p => ({ ...p, nickname: p.nickname?.trim() || null }));
      const response = await fetch("/api/nicknames", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId, nicknames: saved.map(({ id, nickname }) => ({ id, nickname })) }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "No se pudo completar la operación."); return; }
      setDraft(saved); onSaved(saved); setMessage("Motes guardados.");
    } catch { setMessage("No se pudo conectar con el servidor."); }
    finally { setBusy(false); }
  }
  return <section className="position-editor" id={`nicknames-${teamId}`}>
    <h2>Motes de los jugadores</h2>
    <p>El mote sale entre paréntesis en convocatorias y rankings, y solo el mote en las cartas y en la tarjeta de Wallet. Déjalo vacío para quitarlo.</p>
    <div className="position-editor-list">{draft.map(player => <label key={player.id}>
      <PlayerAvatar name={player.name} photoUrl={cardPhoto(player)} small /><span>{player.name}</span>
      <input type="text" aria-label={`Mote de ${player.name}`} placeholder="Mote" maxLength={MAX_NICKNAME} value={player.nickname ?? ""} disabled={busy} onChange={event => setDraft(current => current.map(p => p.id === player.id ? { ...p, nickname: event.target.value } : p))}/>
    </label>)}</div>
    <div className="position-editor-actions"><button className="button primary" disabled={busy} onClick={() => void submit()}>{busy ? "Guardando…" : "Guardar motes"}</button><button className="button secondary" disabled={busy} onClick={() => setDraft(players)}>Restablecer cambios</button></div>
    <p role="status">{message}</p>
  </section>;
}

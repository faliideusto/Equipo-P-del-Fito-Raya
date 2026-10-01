"use client";
import { useIsCoach } from "../app-shell";
import { useState } from "react";
import type { Player, Position, TeamId } from "@/domain/types";
import { PlayerAvatar } from "@/components/player-avatar";
export function PositionEditor({ players, teamId, onSaved }: { players: Player[]; teamId: TeamId; onSaved: (players: Player[]) => void }) {
  const isCoach = useIsCoach();
  const [draft, setDraft] = useState(players);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/positions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", teamId, positions: draft.map(({ id, position }) => ({ id, position })) }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "No se pudo completar la operación."); return; }
      onSaved(draft); setMessage("Posiciones guardadas. Ya puedes usarlas para crear parejas.");
    } catch { setMessage("No se pudo conectar con el servidor."); }
    finally { setBusy(false); }
  }
  if (!isCoach) return null;
  return <section className="position-editor" id={`positions-${teamId}`}>
    <h2>Posiciones de los jugadores</h2>
    <p>Define derecha, revés o ambos para encontrar parejas compatibles.</p>
      <div className="position-editor-list">{draft.map(player => <label key={player.id}>
        <PlayerAvatar name={player.name} photoUrl={player.photoUrl} small /><span>{player.name}</span>
        <select aria-label={`Posición de ${player.name}`} value={player.position || ""} disabled={busy} onChange={event => setDraft(current => current.map(p => p.id === player.id ? { ...p, position: (event.target.value || null) as Position | null } : p))}>
          <option value="">Por confirmar</option><option value="RIGHT">Derecha</option><option value="LEFT">Revés</option><option value="BOTH">Ambos</option>
        </select>
      </label>)}</div>
      <div className="position-editor-actions"><button className="button primary" disabled={busy} onClick={() => void submit()}>{busy ? "Guardando…" : "Guardar posiciones"}</button><button className="button secondary" disabled={busy} onClick={() => setDraft(players)}>Restablecer cambios</button></div>

    <p role="status">{message}</p>
  </section>;
}

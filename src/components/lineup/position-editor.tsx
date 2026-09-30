"use client";
import { useState } from "react";
import type { Player, Position, TeamId } from "@/domain/types";
import { PlayerAvatar } from "@/components/player-avatar";
export function PositionEditor({ players, teamId, onSaved }: { players: Player[]; teamId: TeamId; onSaved: (players: Player[]) => void }) {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [draft, setDraft] = useState(players);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(action: "unlock" | "save") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/positions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, password, teamId, positions: draft.map(({ id, position }) => ({ id, position })) }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "No se pudo completar la operación."); return; }
      if (action === "unlock") { setDraft(players); setUnlocked(true); }
      else { onSaved(draft); setMessage("Posiciones guardadas. Ya puedes usarlas para crear parejas."); }
    } catch { setMessage("No se pudo conectar con el servidor."); }
    finally { setBusy(false); }
  }
  return <section className="position-editor">
    <h2>Posiciones de los jugadores</h2>
    <p>Define derecha, revés o ambos para encontrar parejas compatibles.</p>
    {!unlocked ? <form onSubmit={event => { event.preventDefault(); void submit("unlock"); }}>
      <label htmlFor={`positions-password-${teamId}`}>Contraseña de edición</label>
      <div className="position-unlock"><input id={`positions-password-${teamId}`} type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} /><button className="button primary" disabled={busy}>{busy ? "Comprobando…" : "Desbloquear"}</button></div>
    </form> : <>
      <div className="position-editor-list">{draft.map(player => <label key={player.id}>
        <PlayerAvatar name={player.name} photoUrl={player.photoUrl} small /><span>{player.name}</span>
        <select aria-label={`Posición de ${player.name}`} value={player.position || ""} disabled={busy} onChange={event => setDraft(current => current.map(p => p.id === player.id ? { ...p, position: (event.target.value || null) as Position | null } : p))}>
          <option value="">Por confirmar</option><option value="RIGHT">Derecha</option><option value="LEFT">Revés</option><option value="BOTH">Ambos</option>
        </select>
      </label>)}</div>
      <div className="position-editor-actions"><button className="button primary" disabled={busy} onClick={() => void submit("save")}>{busy ? "Guardando…" : "Guardar posiciones"}</button><button className="button secondary" disabled={busy} onClick={() => { setUnlocked(false); setPassword(""); setMessage(""); }}>Bloquear edición</button></div>
    </>}
    <p role="status">{message}</p>
  </section>;
}

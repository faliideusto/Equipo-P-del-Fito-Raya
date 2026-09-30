"use client";
import { useState } from "react";
import type { Pair, Player, TeamId } from "@/domain/types";
import type { SavedLineup } from "@/lib/saved-lineups";
export function SavedLineups({ teamId, pairs, players, onLoad }: { teamId: TeamId; pairs: Pair[]; players: Player[]; onLoad: (pairs: Pair[]) => void }) {
  const [password, setPassword] = useState(""); const [unlocked, setUnlocked] = useState(false);
  const [name, setName] = useState(""); const [rows, setRows] = useState<SavedLineup[]>([]);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [newPassword, setNewPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  async function changePassword() {
    if (newPassword !== confirmation) { setMessage("Las contraseñas nuevas no coinciden."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/lineups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "change-password", password, newPassword }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error); return; }
      setPassword(""); setNewPassword(""); setConfirmation(""); setRows([]); setUnlocked(false);
      setMessage("Contraseña cambiada. Vuelve a abrir el archivo con la nueva contraseña. También se usará para editar posiciones.");
    } catch { setMessage("No se pudo cambiar la contraseña."); } finally { setBusy(false); }
  }
  async function submit(action: "list" | "save" | "delete", id?: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/lineups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, teamId, action, id, name, pairs }) });
      const result = await response.json();
      if (!response.ok) { if (response.status === 401) { setUnlocked(false); setRows([]); } setMessage(result.error); return; }
      setRows(result.lineups); setUnlocked(true);
      if (action === "save") { setName(""); setMessage("Alineación guardada en el archivo privado del entrenador."); }
      if (action === "delete") setMessage("Alineación eliminada.");
    } catch { setMessage("No se pudo conectar con el servidor."); } finally { setBusy(false); }
  }
  return <section className="position-editor" id={`saved-lineups-${teamId}`}><h2>Alineaciones del entrenador</h2><p>Archivo privado del equipo {teamId.toUpperCase()}. Guarda tus propuestas favoritas, completas o en preparación.</p>
    {!unlocked ? <form onSubmit={e => { e.preventDefault(); void submit("list"); }}><label htmlFor={`lineups-password-${teamId}`}>Contraseña del entrenador</label><div className="position-unlock"><input id={`lineups-password-${teamId}`} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy}/><button className="button" disabled={busy}>{busy ? "Abriendo…" : "Abrir archivo privado"}</button></div></form> : <>
      <form onSubmit={e => { e.preventDefault(); void submit("save"); }}><label htmlFor={`lineup-name-${teamId}`}>Nombre de la alineación</label><div className="position-unlock"><input id={`lineup-name-${teamId}`} placeholder="Ej. Jornada 3 · opción equilibrada" value={name} onChange={e => setName(e.target.value)} maxLength={80} required disabled={busy}/><button className="button" disabled={busy || !pairs.some(p => p.players.some(Boolean))}>Guardar alineación actual</button></div></form>
      <div className="saved-lineups-list">{rows.map(row => <article className="panel" key={row.id}><h3>{row.name}</h3><p className="data-note">{new Date(row.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</p>{row.pairs.map((pair, i) => <p key={pair.id}><strong>Pareja {i + 1}: </strong>{pair.players.map(id => id ? players.find(p => p.id === id)?.name ?? "Jugador fuera de la plantilla" : "Hueco libre").join(" / ")}</p>)}<div className="position-editor-actions"><button className="button secondary" disabled={busy} onClick={() => { const missing = row.pairs.some(p => p.players.some(id => id && !players.some(player => player.id === id))); if (missing) { setMessage("Esta propuesta contiene jugadores que ya no están en la plantilla. No se ha cargado."); return; } if (pairs.some(p => p.players.some(Boolean)) && !window.confirm("¿Reemplazar la alineación de prueba actual?")) return; onLoad(row.pairs); setMessage(`Alineación «${row.name}» cargada arriba.`); }}>Cargar en el laboratorio</button><button className="button secondary" disabled={busy} onClick={() => { if (window.confirm(`¿Eliminar «${row.name}» del archivo?`)) void submit("delete", row.id); }}>Eliminar</button></div></article>)}</div>
      {!rows.length && <p className="data-note">Todavía no hay alineaciones guardadas para este equipo.</p>}
      <details className="coach-password-change"><summary>Cambiar contraseña</summary><p>La nueva contraseña protege las alineaciones de A y B y la edición de posiciones. La anterior dejará de funcionar.</p><form onSubmit={e => { e.preventDefault(); void changePassword(); }}><label htmlFor={`new-coach-password-${teamId}`}>Nueva contraseña</label><input id={`new-coach-password-${teamId}`} type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={e => setNewPassword(e.target.value)} required disabled={busy}/><label htmlFor={`confirm-coach-password-${teamId}`}>Repetir nueva contraseña</label><input id={`confirm-coach-password-${teamId}`} type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} required disabled={busy}/><button className="button" disabled={busy}>Guardar nueva contraseña</button></form></details>
      <button className="button secondary" disabled={busy} onClick={() => { setPassword(""); setNewPassword(""); setConfirmation(""); setRows([]); setUnlocked(false); setMessage(""); }}>Cerrar archivo privado</button>
    </>}
    <p role="status">{message}</p>
  </section>;
}

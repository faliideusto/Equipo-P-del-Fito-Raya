"use client";
import { useState } from "react";

export function NewMemberChoice() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState("");
  const [result, setResult] = useState<{ name: string; players: { id: string; name: string }[]; unavailable: boolean } | null>(null);
  const [error, setError] = useState("");
  async function search() {
    setBusy(true); setError(""); setSelection(""); setResult(null);
    try {
      const response = await fetch("/api/account/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setResult({ ...data, name });
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo buscar el nombre."); }
    finally { setBusy(false); }
  }
  const ready = result?.name === name;
  return <div className="new-member-choice"><input type="hidden" name="registrationMode" value="new"/><input type="hidden" name="searchPlayerId" value={selection === "new" ? "" : selection}/>
    <label>Tu nombre completo<input name="fullName" autoComplete="name" required minLength={5} maxLength={120} value={name} placeholder="Nombre y apellidos" onChange={event => { setName(event.target.value); setSelection(""); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (!busy) void search(); } }}/></label>
    <button type="button" className="button secondary" disabled={busy || name.trim().length < 5} onClick={() => void search()}>{busy ? "Buscando…" : "Buscar mi jugador"}</button>
    {error && <p className="snp-warning" role="alert">{error}</p>}
    {ready && <><p role="status">{result.players.length ? "Selecciona tu jugador entre los resultados, o continúa con tu nombre si ninguno eres tú." : result.unavailable ? "La búsqueda no está disponible ahora. Puedes volver a intentarlo o continuar con tu nombre." : "No hemos encontrado coincidencias. Puedes continuar con tu nombre."}</p><label>Tu jugador<select name="newSelection" required value={selection} onChange={event => setSelection(event.target.value)}><option value="" disabled>Selecciona una opción</option>{result.players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}<option value="new">Continuar como {name.trim()}</option></select></label>{selection && <p className="account-message">Se añadirá tu jugador al equipo elegido al crear la cuenta.</p>}</>}
    {!ready && <select className="sr-only" required value="" onChange={() => {}} aria-label="Busca y selecciona tu jugador"><option value="">Busca tu nombre para continuar</option></select>}
  </div>;
}

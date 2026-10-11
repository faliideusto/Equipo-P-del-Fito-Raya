"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { TeamCaptain } from "@/domain/team-captain";
import { TableSkeleton } from "./skeletons";
type State = { ready: boolean; captains: TeamCaptain[]; teams: { teamId: "a" | "b"; candidates: { id: string; name: string }[] }[] };
// Each team can have several captains: chips to remove them and a select to add another.
export function CoachCaptains() {
  const [data, setData] = useState<State | null>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { void fetch("/api/captains", { cache: "no-store" }).then(r => r.json()).then(d => d.teams ? setData(d) : setMessage(d.error || "No se pudieron cargar los capitanes.")).catch(() => setMessage("No se pudieron cargar los capitanes.")); }, []);
  async function save(teamId: string, playerId: string, action: "add" | "remove") {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/captains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId, playerId, action }) }); const d = await response.json(); if (!response.ok) throw new Error(d.error); setData(d); setMessage(action === "add" ? "Capitán añadido." : "Capitán quitado."); }
    catch (e) { setMessage(e instanceof Error && e.message ? e.message : "No se pudo guardar."); } finally { setBusy(false); }
  }
  const saved = message === "Capitán añadido." || message === "Capitán quitado.";
  return <section className="panel account-card"><h2>Capitanes</h2><p>Los capitanes de cada equipo pueden montar la convocatoria y avisar al equipo en Wallet, corregir resultados y enviar al grupo de WhatsApp el resultado de la jornada. Solo aparecen los jugadores con cuenta en la web.</p>
    {data === null && !message && <div role="status" aria-live="polite"><span className="sr-only">Cargando capitanes…</span><TableSkeleton rows={2}/></div>}
    {data && !data.ready && <p className="snp-warning">Falta la tabla de capitanes: el propietario de Supabase debe ejecutar supabase/team-captains.sql. Mientras tanto, solo el entrenador puede avisar al equipo.</p>}
    {data?.teams.map(team => {
      const captains = data.captains.filter(c => c.team_id === team.teamId);
      const free = team.candidates.filter(c => !captains.some(captain => captain.player_id === c.id));
      const name = (id: string) => team.candidates.find(c => c.id === id)?.name ?? "Jugador sin cuenta en este equipo";
      return <div key={team.teamId} className="captain-team"><h3>Equipo {team.teamId.toUpperCase()}</h3>
        {captains.length ? <ul className="captain-list">{captains.map(c => <li key={c.player_id}>{name(c.player_id)}<button type="button" disabled={busy} aria-label={`Quitar a ${name(c.player_id)} como capitán`} title="Quitar" onClick={() => void save(team.teamId, c.player_id, "remove")}><X size={14} aria-hidden/></button></li>)}</ul> : <p className="captain-empty">Sin capitanes.</p>}
        <label className="captain-select"><span className="sr-only">Añadir capitán al equipo {team.teamId.toUpperCase()}</span><select disabled={busy || !data.ready || !free.length} value="" onChange={e => { if (e.target.value) void save(team.teamId, e.target.value, "add"); }}><option value="">{free.length ? "Añadir capitán…" : "No quedan jugadores con cuenta"}</option>{free.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      </div>;
    })}
    {message && <p role="status" className={saved ? "data-note" : "snp-warning"}>{message}</p>}
  </section>;
}

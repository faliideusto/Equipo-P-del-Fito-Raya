"use client";
import { useEffect, useState } from "react";
import type { TeamCaptain } from "@/domain/team-captain";
import { TableSkeleton } from "./skeletons";
type State = { ready: boolean; captains: TeamCaptain[]; teams: { teamId: "a" | "b"; candidates: { id: string; name: string }[] }[] };
export function CoachCaptains() {
  const [data, setData] = useState<State | null>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { void fetch("/api/captains", { cache: "no-store" }).then(r => r.json()).then(d => d.teams ? setData(d) : setMessage(d.error || "No se pudieron cargar los capitanes.")).catch(() => setMessage("No se pudieron cargar los capitanes.")); }, []);
  async function save(teamId: string, playerId: string) {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/captains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId, playerId }) }); const d = await response.json(); if (!response.ok) throw new Error(d.error); setData(d); setMessage("Capitán guardado."); }
    catch (e) { setMessage(e instanceof Error && e.message ? e.message : "No se pudo guardar."); } finally { setBusy(false); }
  }
  return <section className="panel account-card"><h2>Capitanes</h2><p>El capitán de cada equipo recibe el aviso y puede enviar al grupo de WhatsApp el resultado completo de la jornada.</p>
    {data === null && !message && <div role="status" aria-live="polite"><span className="sr-only">Cargando capitanes…</span><TableSkeleton rows={2}/></div>}
    {data && !data.ready && <p className="snp-warning">Falta la tabla de capitanes: el propietario de Supabase debe ejecutar supabase/team-captains.sql. Mientras tanto, solo el entrenador puede enviar el resultado.</p>}
    {data?.teams.map(team => <label key={team.teamId} className="captain-select">Equipo {team.teamId.toUpperCase()}<select disabled={busy || !data.ready} value={data.captains.find(c => c.team_id === team.teamId)?.player_id ?? ""} onChange={e => void save(team.teamId, e.target.value)}><option value="">Sin capitán</option>{team.candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>)}
    {message && <p role="status" className={message === "Capitán guardado." ? "data-note" : "snp-warning"}>{message}</p>}
  </section>;
}

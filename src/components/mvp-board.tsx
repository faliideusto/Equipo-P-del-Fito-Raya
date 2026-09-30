"use client";
import { useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { PlayerAvatar } from "./player-avatar";
import type { Player, TeamId } from "@/domain/types";
import type { MvpAward } from "@/lib/mvp";
function monthLabel(month: string) { return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "Europe/Madrid" }).format(new Date(`${month}-15T12:00:00Z`)); }
export function MvpBoard({ players, initialAwards, initialMonth, initialError }: { players: Record<TeamId, Player[]>; initialAwards: MvpAward[]; initialMonth: string; initialError: string }) {
  const [awards, setAwards] = useState(initialAwards); const [month, setMonth] = useState(initialMonth);
  const [password, setPassword] = useState(""); const [unlocked, setUnlocked] = useState(false);
  const [draft, setDraft] = useState<Record<TeamId, string>>({ a: "", b: "" });
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(initialError);
  async function submit(teamId?: TeamId, clear = false) {
    const current = awards.find(row => row.team_id === teamId && row.month === month);
    if (teamId && current && !window.confirm(`¿Cambiar el MVP de ${monthLabel(month)} del equipo ${teamId.toUpperCase()}?`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/mvp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, action: teamId ? clear || !draft[teamId] ? "clear" : "save" : "unlock", teamId, month, playerId: teamId ? draft[teamId] : undefined }) });
      const result = await response.json();
      if (!response.ok) { if (response.status === 401) { setUnlocked(false); setPassword(""); } setMessage(result.error); return; }
      if (teamId) { setAwards(result.awards); setDraft({ ...draft, [teamId]: "" }); setMessage(`MVP del equipo ${teamId.toUpperCase()} ${clear || !draft[teamId] ? "retirado" : "guardado"} para ${monthLabel(month)}.`); }
      else setUnlocked(true);
    } catch { setMessage("No se pudo conectar con el servidor."); } finally { setBusy(false); }
  }
  return <><section className="panel mvp-month"><label htmlFor="mvp-month">Mes del reconocimiento</label><input id="mvp-month" type="month" value={month} min="2000-01" max="2099-12" onChange={e => { if (e.target.value) { setMonth(e.target.value); setDraft({ a: "", b: "" }); } }}/></section>
    <div className="mvp-grid">{(["a", "b"] as const).map(team => {
      const award = awards.find(row => row.team_id === team && row.month === month);
      const person = award ? players[team].find(p => p.id === award.player_id) : undefined;
      return <section className="panel mvp-card" key={team}><span className="badge blue">Equipo {team.toUpperCase()}</span><Trophy className="mvp-trophy" size={38}/><p className="eyebrow">{monthLabel(month)}</p>{award ? <><PlayerAvatar name={award.name} photoUrl={person?.photoUrl ?? award.photo_url}/><h2>{person?.name ?? award.name}</h2><p>Elegido por el entrenador</p><Link className="text-link" href={`/competicion/jugadores/${award.source_id}`}>Ver ficha del jugador →</Link></> : <><h2>El próximo MVP</h2><p>El entrenador todavía no ha elegido al MVP de este mes.</p></>}</section>;
    })}</div>
    <section className="position-editor"><h2>Elección del entrenador</h2><p>Un reconocimiento por mes para cada equipo, con la misma contraseña del archivo privado.</p>{!unlocked ? <form onSubmit={e => { e.preventDefault(); void submit(); }}><label htmlFor="mvp-password">Contraseña del entrenador</label><div className="position-unlock"><input id="mvp-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy}/><button className="button" disabled={busy}>{busy ? "Comprobando…" : "Elegir MVP"}</button></div></form> : <><div className="mvp-grid">{(["a", "b"] as const).map(team => <form key={team} onSubmit={e => { e.preventDefault(); void submit(team); }}><label htmlFor={`mvp-player-${team}`}>MVP equipo {team.toUpperCase()} · {monthLabel(month)}</label><select id={`mvp-player-${team}`} value={draft[team]} disabled={busy} onChange={e => setDraft({ ...draft, [team]: e.target.value })}><option value="">Selecciona un jugador</option>{players[team].map(player => <option key={player.id} value={player.id}>{player.name}</option>)}</select><button className="button" disabled={busy}>Guardar MVP del {team.toUpperCase()}</button><button type="button" className="button secondary" disabled={busy || !awards.some(row => row.team_id === team && row.month === month)} onClick={() => void submit(team, true)}>Dejar sin MVP</button></form>)}</div><button className="button secondary" disabled={busy} onClick={() => { setPassword(""); setUnlocked(false); }}>Cerrar edición</button></> }<p role="status">{message}</p></section>
    <section className="panel"><div className="panel-heading"><h2>Historial de MVP</h2></div>{awards.length ? <div className="table-scroll"><table className="standings"><thead><tr><th>MES</th><th>EQUIPO</th><th>JUGADOR</th></tr></thead><tbody>{awards.map(award => <tr key={`${award.team_id}-${award.month}`}><td>{monthLabel(award.month)}</td><td>{award.team_id.toUpperCase()}</td><td><Link href={`/competicion/jugadores/${award.source_id}`}>{award.name}</Link></td></tr>)}</tbody></table></div> : <p className="data-note">Los reconocimientos aparecerán aquí cuando el entrenador los guarde.</p>}</section>
  </>;
}

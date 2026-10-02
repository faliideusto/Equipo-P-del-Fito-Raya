"use client";
import { useEffect, useState } from "react";
import { NewMemberChoice } from "./new-member-choice";
type Choice = { id: string; name: string; available: boolean };
const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function RosterChoice({ allowAdditional = false }: { allowAdditional?: boolean }) {
  const [additional, setAdditional] = useState(false);
  const [team, setTeam] = useState(""); const [query, setQuery] = useState(""); const [selected, setSelected] = useState("");
  const [result, setResult] = useState<{ team: string; players: Choice[]; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!team) return;
    const controller = new AbortController();
    fetch(`/api/account/roster?team=${team}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setResult({ team, players: data.players });
    }).catch(error => { if (!controller.signal.aborted) setResult({ team, players: [], error: error.message }); });
    return () => controller.abort();
  }, [team, retry]);
  const ready = result?.team === team;
  const matches = ready ? result.players.filter(player => normalized(player.name).includes(normalized(query.trim()))) : [];
  const person = ready ? result.players.find(player => player.id === selected) : undefined;
  return <div className="account-snp-registration"><h2>¿Quién eres en el equipo?</h2><p>Elige tu equipo y busca tu nombre en la plantilla.</p>
    <label>Tu equipo<select name="teamId" required value={team} onChange={event => { setTeam(event.target.value); setQuery(""); setSelected(""); }}><option value="" disabled>Selecciona A o B</option><option value="a">Escuela Fito Raya · Equipo A</option><option value="b">Escuela Fito Raya · Equipo B</option></select></label>
    {team && additional ? <NewMemberChoice key={team}/> : <>{team && !ready && <p role="status">Cargando plantilla…</p>}
    {ready && result.error && <><p role="alert" className="snp-warning">{result.error}</p><button type="button" className="button secondary" onClick={() => setRetry(value => value + 1)}>Volver a cargar plantilla</button></>}
    {ready && !result.error && <><label>Buscar tu nombre<input type="search" placeholder="Escribe tu nombre o apellidos" value={query} onChange={event => { setQuery(event.target.value); setSelected(""); }}/></label><label>Tu jugador<select className="roster-select" name="playerId" size={6} value={selected} onChange={event => setSelected(event.target.value)} required><option value="" disabled>Selecciona tu nombre</option>{matches.map(player => <option value={player.id} key={player.id} disabled={!player.available}>{player.name}{!player.available ? " · Ya tiene cuenta" : ""}</option>)}</select></label>{!matches.length && <p role="status">No hay jugadores con ese nombre en este equipo.</p>}{person && <p className="account-message" role="status">Jugador seleccionado: <strong>{person.name}</strong> · Equipo {team.toUpperCase()}</p>}</>}</>}
    {team && allowAdditional && <button type="button" className="text-link new-member-toggle" onClick={() => { setAdditional(value => !value); setSelected(""); }}>{additional ? "Volver a la plantilla" : "¿No encuentras tu nombre?"}</button>}
    {/* Always validate against the current server roster, including when the
        browser submits before loading finishes or alters an option. */}
    {!ready || result?.error ? <input type="hidden" name="playerId" value=""/> : null}
    <p className="data-note">Selecciona únicamente tu propia ficha. Si aparece «Ya tiene cuenta», inicia sesión o consulta al entrenador.</p>
  </div>;
}

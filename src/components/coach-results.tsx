"use client";
import { useEffect, useState } from "react";
import type { CoachTeamResults } from "@/lib/pending-results-service";
export function CoachResults() {
  const [teams, setTeams] = useState<CoachTeamResults[] | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { void fetch("/api/results", { cache: "no-store" }).then(r => r.json()).then(d => d.teams ? setTeams(d.teams) : setMessage(d.error || "No se pudieron cargar los resultados.")).catch(() => setMessage("No se pudieron cargar los resultados.")); }, []);
  async function remove(fixtureId: string, teamId: string, pairIndex: number) {
    if (!confirm(`¿Borrar el resultado de la pareja ${pairIndex}? Se volverá a pedir a los jugadores.`)) return;
    const response = await fetch("/api/results", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fixtureId, teamId, pairIndex }) });
    const data = await response.json(); if (data.teams) setTeams(data.teams); else setMessage(data.error || "No se pudo borrar.");
  }
  return <section className="panel account-card"><h2>Resultados enviados</h2><p>Lo que los jugadores han registrado en la última jornada, para completar el acta en SNP.</p>
    {teams?.map(team => <div key={team.teamId}><h3>Equipo {team.teamId.toUpperCase()}{team.fixture && ` · Jornada ${team.fixture.round} vs ${team.fixture.opponent}`}</h3>
      {!team.fixture ? <p>Sin jornada disputada.</p> : team.results.length === 0 ? <p>Nadie ha enviado resultado todavía.</p> :
        <ul className="coach-results">{team.results.map(r => <li key={r.pair_index}><b>Pareja {r.pair_index}</b><span>{r.sets.map(s => s.join("-")).join(" · ")}</span><small>{r.player_name}</small><button type="button" className="text-link" onClick={() => void remove(r.fixture_id, r.team_id, r.pair_index)}>Borrar</button></li>)}</ul>}
    </div>)}
    {message && <p role="alert" className="snp-warning">{message}</p>}
  </section>;
}

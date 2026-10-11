"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { SnpResult, SnpTeam, SnpCompetition } from "@/domain/snp";
import { PageHeading } from "./sports";
import { PlayerAvatar } from "./player-avatar";
import { formatPoints } from "@/lib/format";
import { MiniLineup } from "./lineup/mini-lineup";
import { TeamSchedule } from "./team-schedule";

export function ExplorerTeam({ id, filters }: { id: string; filters: Partial<SnpCompetition["filters"]> }) {
  const [result, setResult] = useState<SnpResult<SnpTeam> | null>(null);
  const [error, setError] = useState("");
  const [competition, setCompetition] = useState<SnpResult<SnpCompetition> | null>(null);
  const [calendarError, setCalendarError] = useState("");
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    if (!JSON.parse(filterKey).division) return;
    const controller = new AbortController();
    async function update() {
      try {
        const response = await fetch("/api/snp/competition?" + new URLSearchParams(JSON.parse(filterKey)), { signal: controller.signal });
        const value = await response.json();
        if (controller.signal.aborted) return;
        if (response.ok) {
          setCompetition(value);
          setCalendarError("");
        } else {
          setCalendarError(value.error || "No se pudo consultar el calendario del equipo.");
        }
      } catch {
        if (!controller.signal.aborted) setCalendarError("No se pudo consultar el calendario del equipo.");
      }
    }
    void update();
    const timer = setInterval(() => { if (!document.hidden) void update(); }, 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [filterKey]);

  useEffect(() => {
    let cancelled = false;
    async function update() {
      try {
        const response = await fetch(`/api/snp/teams/${id}`);
        const value = await response.json();
        if (cancelled) return;
        if (response.ok) { setResult(value); setError(""); }
        else setError(value.error);
      } catch {
        if (!cancelled) setError("No se pudo consultar el equipo.");
      }
    }
    void update();
    const timer = setInterval(() => { if (!document.hidden) void update(); }, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [id]);

  const team = result?.data;
  const calendar = competition?.data.calendar
    .filter(f => f.homeId === id || f.awayId === id)
    .map(f => competition.data.fixtures.find(updated => updated.id === f.id && updated.score) || f) || [];

  return (
    <>
      <Link href={filters.division ? "/competicion?" + new URLSearchParams(JSON.parse(filterKey)) : "/competicion"} className="text-link back-link">← Volver a competición</Link>
      <PageHeading eyebrow={`EQUIPO SNP · ${id}`} title={team?.name.replaceAll("_", " ") || "La ficha del equipo."} text={team ? `${team.players.length} ${team.players.length === 1 ? "jugador" : "jugadores"} · Jornadas, resultados y plantilla SNP` : "Consultando ficha…"} logoName={team?.name}/>
      {(error || result?.error) && <p className="snp-warning" role="status">{error || result?.error}</p>}
      {(calendarError || competition?.error) && <p className="snp-warning" role="status">{calendarError || competition?.error}</p>}
      {filters.division ? competition ? <TeamSchedule key={`${id}-${filterKey}`} fixtures={calendar} teamId={id} query={new URLSearchParams(JSON.parse(filterKey)).toString()}/> : !calendarError && <section className="panel connection-panel"><p role="status">Consultando jornadas y resultados…</p></section> : <section className="panel connection-panel"><h2>Jornadas y resultados</h2><p>Selecciona la división del equipo en competición para consultar su calendario.</p><Link href="/competicion" className="text-link">Buscar en competición →</Link></section>}
      {team && <>
        <section className="panel">
          <div className="panel-heading"><h2>Plantilla</h2><span className="badge blue">{result.stale ? "Consulta guardada" : "SNP"}</span></div>
          <div className="roster-list">
            {[...team.players].sort((a, b) => b.points - a.points).map((player, index) => (
              <Link className="roster-row" key={player.id} href={`/competicion/jugadores/${player.id}?equipo=${id}&${new URLSearchParams(JSON.parse(filterKey))}`}>
                <span className="roster-rank">{String(index + 1).padStart(2, "0")}</span>
                <PlayerAvatar name={player.name} photoUrl={player.photoUrl}/>
                <div className="roster-name"><strong>{player.name}</strong><span>Ver ficha del jugador →</span></div>
                <div className="roster-points"><strong>{formatPoints(player.points)}</strong><span>PTS SNP</span></div>
              </Link>
            ))}
          </div>
        </section>
        {id !== "7778" && id !== "803902" && <details className="panel team-tools"><summary><span>Probar una alineación<small>Forma parejas y compara sus puntos SNP</small></span><span className="team-tools-arrow" aria-hidden="true">↓</span></summary><MiniLineup key={id} players={team.players}/></details>}
        <p className="data-note">Consulta: {new Date(result.updatedAt).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })} · {result.stale ? "Datos guardados" : "Fuente original SNP"}</p>
      </>}
    </>
  );
}

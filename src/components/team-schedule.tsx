"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock3 } from "lucide-react";
import type { SnpFixture } from "@/domain/snp";
import { formatDate, formatTime } from "@/lib/format";
import { TeamLogo } from "./team-logo";

export function TeamSchedule({ fixtures, teamId, matchBaseHref = "/competicion/actas", query = "" }: {
  fixtures: SnpFixture[];
  teamId: string;
  matchBaseHref?: string;
  query?: string;
}) {
  const [filter, setFilter] = useState("all");
  const played = fixtures.filter(f => f.score).sort((a, b) => b.round - a.round);
  const upcoming = fixtures.filter(f => !f.score).sort((a, b) => a.round - b.round);
  const groups = [
    { key: "played", title: "Partidos jugados", text: "Los resultados más recientes, primero.", matches: played },
    { key: "upcoming", title: "Próximas jornadas", text: "Los próximos encuentros de la temporada.", matches: upcoming },
  ].filter(group => filter === "all" || filter === group.key);

  return <section className="panel team-schedule" aria-label="Jornadas del equipo">
    <div className="team-schedule-heading">
      <div><p className="eyebrow">LA TEMPORADA</p><h2>Jornadas y resultados</h2><p>Rivales, fechas y actas de cada encuentro.</p></div>
      <div className="schedule-filters" aria-label="Filtrar jornadas">
        {[
          { key: "all", label: "Todas", count: fixtures.length },
          { key: "played", label: "Jugadas", count: played.length },
          { key: "upcoming", label: "Pendientes", count: upcoming.length },
        ].map(item => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}<span>{item.count}</span></button>)}
      </div>
    </div>
    {groups.map(group => <div className="schedule-group" key={group.key}>
      <div className="schedule-group-heading"><h3>{group.title}</h3><p>{group.text}</p></div>
      {group.matches.length ? <div className="schedule-grid">{group.matches.map(fixture => {
        const home = fixture.homeId === teamId;
        const ownName = home ? fixture.homeName : fixture.awayName;
        const opponent = home ? fixture.awayName : fixture.homeName;
        const ownScore = fixture.score?.[home ? 0 : 1];
        const rivalScore = fixture.score?.[home ? 1 : 0];
        return <Link key={fixture.id} href={`${matchBaseHref}/${fixture.id}${query ? `?${query}` : ""}`} className={`schedule-card ${fixture.score ? "is-played" : ""}`}>
          <div className="schedule-card-top"><span>{fixture.round === 1000 ? "Jornada de retos" : `Jornada ${String(fixture.round).padStart(2, "0")}`}</span><span className={`badge ${fixture.score ? "muted" : "blue"}`}>{fixture.score ? "Disputada" : "Pendiente"}</span></div>
          <div className="schedule-versus">
            <div><TeamLogo name={ownName}/><strong>{ownName.replaceAll("_", " ")}</strong><small>{home ? "Local" : "Visitante"}</small></div>
            <b>{fixture.score ? `${ownScore} – ${rivalScore}` : "VS"}</b>
            <div><TeamLogo name={opponent}/><strong>{opponent.replaceAll("_", " ")}</strong><small>{home ? "Visitante" : "Local"}</small></div>
          </div>
          <div className="schedule-card-bottom"><span><CalendarDays size={14}/>{formatDate(fixture.date || "")}</span><span><Clock3 size={14}/>{formatTime(fixture.date || "")}</span></div>
          <div className="schedule-card-action"><span>{fixture.score ? "Ver partidos y acta" : "Ver encuentro"}</span><ArrowUpRight size={16}/></div>
        </Link>;
      })}</div> : <p className="schedule-empty">{group.key === "played" ? "Todavía no hay resultados publicados para este equipo." : "No hay próximos encuentros publicados."}</p>}
    </div>)}
  </section>;
}

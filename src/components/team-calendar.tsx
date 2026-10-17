"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { SnpFixture } from "@/domain/snp";
import { calendarMonths, fixtureDay, fixtureOutcome, initialMonth, monthGrid, type FixtureOutcome } from "@/domain/schedule-calendar";
import { formatTime } from "@/lib/format";
import { TeamLogo } from "./team-logo";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const OUTCOME_LABEL: Record<FixtureOutcome, string> = { win: "Victoria", draw: "Empate", loss: "Derrota", pending: "Pendiente" };
const monthLabel = (month: string) => new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
const dayLabel = (day: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { ...options, timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
const roundLabel = (round: number) => round === 1000 ? "Retos" : `J${round}`;
const teamName = (name: string) => name.replaceAll("_", " ");

export function TeamCalendar({ fixtures, teamId, today, matchBaseHref }: {
  fixtures: SnpFixture[];
  teamId: string;
  today: string;
  matchBaseHref: string;
}) {
  const months = calendarMonths(fixtures);
  const [month, setMonth] = useState(() => initialMonth(fixtures, today));
  const [selected, setSelected] = useState<string | null>(null);
  const undated = fixtures.filter(f => !fixtureDay(f.date)).sort((a, b) => a.round - b.round);
  const byDay = new Map<string, SnpFixture[]>();
  for (const fixture of fixtures) {
    const day = fixtureDay(fixture.date);
    if (day) byDay.set(day, [...(byDay.get(day) ?? []), fixture]);
  }
  const index = month ? months.indexOf(month) : -1;
  const monthFixtures = month ? fixtures.filter(f => fixtureDay(f.date)?.startsWith(month)).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")) : [];
  const go = (delta: number) => { setMonth(months[index + delta]); setSelected(null); };

  const agendaRow = (fixture: SnpFixture) => {
    const home = fixture.homeId === teamId;
    const opponent = home ? fixture.awayName : fixture.homeName;
    const outcome = fixtureOutcome(fixture, teamId);
    const day = fixtureDay(fixture.date);
    const score = fixture.score ? `${fixture.score[home ? 0 : 1]}–${fixture.score[home ? 1 : 0]}` : null;
    return <li key={fixture.id}>
      <Link href={`${matchBaseHref}/${fixture.id}`} className={`calendar-agenda-row is-${outcome}`} aria-current={selected === day ? "true" : undefined}>
        <span className="calendar-agenda-date">{day ? <><small>{dayLabel(day, { weekday: "short" })}</small><b>{dayLabel(day, { day: "numeric" })}</b></> : <small>Por fijar</small>}</span>
        <span className="calendar-agenda-match">
          <small>{fixture.round === 1000 ? "Jornada de retos" : `Jornada ${String(fixture.round).padStart(2, "0")}`} · {home ? "Local" : "Visitante"}</small>
          <span><TeamLogo name={opponent}/><strong>{teamName(opponent)}</strong></span>
        </span>
        <span className="calendar-agenda-result">
          {score ? <b>{score}</b> : <b className="is-time">{fixture.date?.includes("T") ? formatTime(fixture.date) : "VS"}</b>}
          <small>{OUTCOME_LABEL[outcome]}</small>
        </span>
        <ArrowUpRight size={16} aria-hidden="true"/>
      </Link>
    </li>;
  };

  return <section className="panel team-calendar" aria-label="Calendario de jornadas">
    {month ? <>
      <div className="calendar-toolbar">
        <button type="button" onClick={() => go(-1)} disabled={index <= 0} aria-label="Mes anterior"><ChevronLeft size={18}/></button>
        <h2 aria-live="polite">{monthLabel(month)}</h2>
        <button type="button" onClick={() => go(1)} disabled={index >= months.length - 1} aria-label="Mes siguiente"><ChevronRight size={18}/></button>
      </div>
      <div className="calendar-grid">
        <div className="calendar-week" aria-hidden="true">{WEEKDAYS.map(day => <span key={day} className="calendar-weekday">{day}</span>)}</div>
        {chunk(monthGrid(month), 7).map(week => <div className="calendar-week" key={week[0].key}>{week.map(cell => {
          const games = cell.inMonth ? byDay.get(cell.key) ?? [] : [];
          const className = `calendar-day${cell.inMonth ? "" : " is-outside"}${cell.key === today ? " is-today" : ""}${games.length ? ` has-match is-${fixtureOutcome(games[0], teamId)}` : ""}`;
          if (!games.length) return <span key={cell.key} className={className} aria-hidden={!cell.inMonth || undefined}><span className="calendar-day-number">{cell.day}</span></span>;
          return <button key={cell.key} type="button" className={className} aria-pressed={selected === cell.key} onClick={() => setSelected(selected === cell.key ? null : cell.key)}
            aria-label={`${dayLabel(cell.key, { weekday: "long", day: "numeric", month: "long" })}: ${games.map(g => `${g.round === 1000 ? "jornada de retos" : `jornada ${g.round}`} contra ${teamName(g.homeId === teamId ? g.awayName : g.homeName)}, ${OUTCOME_LABEL[fixtureOutcome(g, teamId)].toLowerCase()}`).join("; ")}`}>
            <span className="calendar-day-number">{cell.day}</span>
            {games.map(game => {
              const home = game.homeId === teamId;
              return <span className="calendar-day-match" key={game.id}>
                <b>{roundLabel(game.round)}</b>
                <span className="calendar-day-opponent">{teamName(home ? game.awayName : game.homeName)}</span>
                {game.score && <span className="calendar-day-score">{game.score[home ? 0 : 1]}–{game.score[home ? 1 : 0]}</span>}
              </span>;
            })}
          </button>;
        })}</div>)}
      </div>
      <ul className="calendar-legend" aria-label="Leyenda">{(["win", "draw", "loss", "pending"] as const).map(outcome => <li key={outcome} className={`is-${outcome}`}>{OUTCOME_LABEL[outcome]}</li>)}</ul>
      <div className="calendar-agenda">
        <h3>{monthFixtures.length ? `${monthFixtures.length} ${monthFixtures.length === 1 ? "encuentro" : "encuentros"} en ${monthLabel(month).split(" ")[0]}` : `Sin encuentros en ${monthLabel(month).split(" ")[0]}`}</h3>
        {monthFixtures.length > 0 && <ul>{monthFixtures.map(agendaRow)}</ul>}
      </div>
    </> : <p className="schedule-empty">SNP todavía no ha publicado fechas para este equipo.</p>}
    {undated.length > 0 && <div className="calendar-agenda"><h3>Fecha por confirmar</h3><ul>{undated.map(agendaRow)}</ul></div>}
  </section>;
}

function chunk<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));
}

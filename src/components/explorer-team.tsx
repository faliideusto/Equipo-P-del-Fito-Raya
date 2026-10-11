"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SnpResult, SnpTeam, SnpCompetition, SnpFixture } from "@/domain/snp";
import type { Standing } from "@/domain/types";
import { MatchBoard, StandingsTable } from "./sports";
import { PlayerAvatar } from "./player-avatar";
import { TeamLogo } from "./team-logo";
import { formatDate, formatPoints } from "@/lib/format";
import { MiniLineup } from "./lineup/mini-lineup";
import { TeamSchedule } from "./team-schedule";
import { RivalTabs, type RivalView } from "./team-tabs";
import { PageSkeleton } from "./skeletons";
import { isForcedCheck, SNP_CHECKED_EVENT } from "@/lib/snp-updates";

export function ExplorerTeam({ id, filters, view }: { id: string; filters: Partial<SnpCompetition["filters"]>; view: RivalView }) {
  const [result, setResult] = useState<SnpResult<SnpTeam> | null>(null);
  const [error, setError] = useState("");
  const [competition, setCompetition] = useState<SnpResult<SnpCompetition> | null>(null);
  const [calendarError, setCalendarError] = useState("");
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    if (!JSON.parse(filterKey).division) return;
    const controller = new AbortController();
    async function update(force = false) {
      try {
        const params = new URLSearchParams(JSON.parse(filterKey)); if (force) params.set("refresh", "1");
        const response = await fetch("/api/snp/competition?" + params, { signal: controller.signal });
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
    const onCheck = (event: Event) => void update(isForcedCheck(event));
    window.addEventListener(SNP_CHECKED_EVENT, onCheck);
    return () => { controller.abort(); window.removeEventListener(SNP_CHECKED_EVENT, onCheck); };
  }, [filterKey]);

  useEffect(() => {
    let cancelled = false;
    async function update(force = false) {
      try {
        const response = await fetch(`/api/snp/teams/${id}${force ? "?refresh=1" : ""}`);
        const value = await response.json();
        if (cancelled) return;
        if (response.ok) { setResult(value); setError(""); }
        else setError(value.error);
      } catch {
        if (!cancelled) setError("No se pudo consultar el equipo.");
      }
    }
    void update();
    const onCheck = (event: Event) => void update(isForcedCheck(event));
    window.addEventListener(SNP_CHECKED_EVENT, onCheck);
    return () => { cancelled = true; window.removeEventListener(SNP_CHECKED_EVENT, onCheck); };
  }, [id]);

  const team = result?.data;
  const query = new URLSearchParams(JSON.parse(filterKey)).toString();
  const href = (next: RivalView) => {
    const params = new URLSearchParams(JSON.parse(filterKey));
    if (next !== "resumen") params.set("vista", next);
    const value = params.toString();
    return `/competicion/equipos/${id}${value ? `?${value}` : ""}`;
  };
  const calendar = competition?.data.calendar
    .filter(f => f.homeId === id || f.awayId === id)
    .map(f => competition.data.fixtures.find(updated => updated.id === f.id && updated.score) || f) || [];
  const standings = competition?.data.standings ?? [];
  const rows: Standing[] = standings.map(row => ({ ...row, own: row.teamId === id }));
  const ownIndex = standings.findIndex(row => row.teamId === id);
  const own = standings[ownIndex];
  const division = competition?.data.divisions.find(option => option.id === filters.division)?.name;
  const name = (team?.name || own?.name || "").replaceAll("_", " ");
  const players = team ? [...team.players].sort((a, b) => b.points - a.points) : [];
  const standingOf = (teamId: string) => {
    const index = standings.findIndex(row => row.teamId === teamId);
    return index >= 0 ? { position: index + 1, points: standings[index].points } : undefined;
  };
  const next = calendar.filter(f => !f.score).sort((a, b) => a.round - b.round)[0];
  const played = calendar.filter(f => f.score).sort((a, b) => b.round - a.round);
  const backHref = filters.division ? `/competicion?${query}` : "/competicion";
  const noDivision = <section className="panel connection-panel"><h2>Jornadas y clasificación</h2><p>Selecciona la división del equipo en competición para consultar su calendario y su clasificación.</p><Link href="/competicion" className="text-link">Buscar en competición →</Link></section>;
  const loadingCompetition = !calendarError && <PageSkeleton variant="table" heading={false} label="Consultando jornadas y clasificación…"/>;
  const loadingTeam = error || (result && !result.data)
    ? <section className="panel empty-state"><h2>Plantilla no disponible.</h2><p>SNP no ha devuelto la plantilla de este equipo. Vuelve a intentarlo en un rato.</p></section>
    : <PageSkeleton variant="cards" heading={false} label="Consultando la plantilla…"/>;
  // Only explain a failure when there is nothing to show; saved data is shown quietly.
  const warnings = [...new Set([!result && error, !competition && calendarError].filter((warning): warning is string => Boolean(warning)))];

  const roster = team && (
    <section className="panel">
      <div className="panel-heading"><h2>Plantilla</h2><span className="badge blue">SNP</span></div>
      <div className="roster-list">
        {players.map((player, index) => (
          <Link className="roster-row" key={player.id} href={`/competicion/jugadores/${player.id}?equipo=${id}${query ? `&${query}` : ""}`}>
            <span className="roster-rank">{String(index + 1).padStart(2, "0")}</span>
            <PlayerAvatar name={player.name} photoUrl={player.photoUrl}/>
            <div className="roster-name"><strong>{player.name}</strong><span>Ver ficha del jugador →</span></div>
            <div className="roster-points"><strong>{formatPoints(player.points)}</strong><span>PTS SNP</span></div>
          </Link>
        ))}
      </div>
    </section>
  );

  return (
    <>
      <header className="team-header">
        <div className="team-header-identity">
          {(team?.name || own?.name) && <TeamLogo name={team?.name || own!.name} large />}
          <div>
            <p className="eyebrow">Rival{division ? ` · ${division}` : ""}</p>
            <h1 className="team-header-name">{name || "La ficha del equipo."}</h1>
          </div>
        </div>
        <dl className="team-header-stats">
          <div><dt>Puesto</dt><dd>{own ? `${ownIndex + 1}º` : "—"}{own && <small> de {standings.length}</small>}</dd></div>
          <div><dt>Puntos</dt><dd>{own?.points ?? "—"}</dd></div>
          <div><dt>V – D</dt><dd>{own ? `${own.won}–${own.lost}` : "—"}</dd></div>
        </dl>
        <Link className="team-switch" href={backHref}>← Volver a competición</Link>
      </header>
      <RivalTabs active={view} href={href} name={name || "este equipo"} />
      {warnings.map(warning => <p key={warning} className="snp-warning" role="status">{warning}</p>)}

      {view === "resumen" && <>
        {!filters.division ? noDivision : !competition ? loadingCompetition : next ? (
          <MatchBoard
            label={`Próximo encuentro de ${name}`}
            meta={`Jornada ${String(next.round).padStart(2, "0")}${division ? ` · ${division}` : ""}`}
            date={next.date || ""}
            home={{ name: next.homeName.replaceAll("_", " "), logo: next.homeName, info: standingOf(next.homeId) }}
            away={{ name: next.awayName.replaceAll("_", " "), logo: next.awayName, info: standingOf(next.awayId) }}
            actions={<Link className="text-link" href={`/competicion/actas/${next.id}${query ? `?${query}` : ""}`}>Ver encuentro <ArrowRight size={16} /></Link>}
          />
        ) : (
          <section className="panel empty-state">
            <h2>No hay encuentros pendientes publicados.</h2>
            <p>Consulta el calendario completo en Jornadas.</p>
          </section>
        )}
        {competition && (
          <div className="overview-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>Clasificación</h2>
                <Link className="text-link" href={href("clasificacion")} scroll={false}>Ver completa <ArrowRight size={16} /></Link>
              </div>
              <StandingsTable rows={rows} division={filters.division} compact ownLabel="ESTE EQUIPO" />
            </section>
            <div className="overview-side">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Resultados</h2>
                  <Link className="text-link" href={href("jornadas")} scroll={false}>Calendario <ArrowRight size={16} /></Link>
                </div>
                {played.length ? (
                  <div className="result-list">{played.slice(0, 3).map(f => <RivalResult key={f.id} fixture={f} teamId={id} query={query} />)}</div>
                ) : (
                  <p className="panel-empty">Todavía no hay resultados publicados para este equipo.</p>
                )}
              </section>
              {team && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Mejor ranking SNP</h2>
                    <Link className="text-link" href={href("plantilla")} scroll={false}>{players.length} jugadores <ArrowRight size={16} /></Link>
                  </div>
                  <ol className="top-players">
                    {players.slice(0, 5).map((player, index) => (
                      <li key={player.id}>
                        <Link href={`/competicion/jugadores/${player.id}?equipo=${id}${query ? `&${query}` : ""}`}>
                          <span className="top-rank">{String(index + 1).padStart(2, "0")}</span>
                          <PlayerAvatar name={player.name} photoUrl={player.photoUrl} />
                          <span className="top-name">{player.name}</span>
                          <span className="top-points">{formatPoints(player.points)}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          </div>
        )}
      </>}

      {view === "jornadas" && (!filters.division ? noDivision : competition ? <TeamSchedule key={`${id}-${filterKey}`} fixtures={calendar} teamId={id} query={query}/> : loadingCompetition)}

      {view === "clasificacion" && (!filters.division ? noDivision : competition ? (
        <section className="panel">
          <div className="panel-heading"><h2>Clasificación</h2>{division && <span className="badge blue">{division}</span>}</div>
          <StandingsTable rows={rows} division={filters.division} ownLabel="ESTE EQUIPO" />
        </section>
      ) : loadingCompetition)}

      {view === "plantilla" && (roster || loadingTeam)}

      {view === "parejas" && (team ? (
        <section className="panel team-tools">
          <div className="panel-heading"><h2>Crear parejas</h2><span className="badge blue">Puntos SNP</span></div>
          <MiniLineup key={id} players={team.players}/>
        </section>
      ) : loadingTeam)}

      {result && <p className="data-note">Consulta: {new Date(result.updatedAt).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })} · SNP</p>}
    </>
  );
}

function RivalResult({ fixture, teamId, query }: { fixture: SnpFixture; teamId: string; query: string }) {
  const home = fixture.homeId === teamId;
  const opponent = home ? fixture.awayName : fixture.homeName;
  const own = fixture.score![home ? 0 : 1];
  const rival = fixture.score![home ? 1 : 0];
  const outcome = own > rival ? "Victoria" : own < rival ? "Derrota" : null;
  return (
    <Link className="result-row" href={`/competicion/actas/${fixture.id}${query ? `?${query}` : ""}`}>
      <span className="result-round">J{String(fixture.round).padStart(2, "0")}</span>
      <TeamLogo name={opponent} />
      <span className="result-name"><strong>{home ? "vs" : "en"} {opponent.replaceAll("_", " ")}</strong><small>{formatDate(fixture.date || "")} · {home ? "Local" : "Visitante"}</small></span>
      <b className="result-score">{own}–{rival}</b>
      {outcome ? <span className={`result-outcome is-${outcome.toLowerCase()}`}>{outcome}</span> : <span aria-hidden="true" />}
    </Link>
  );
}

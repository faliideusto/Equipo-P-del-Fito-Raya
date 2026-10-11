import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import type { Fixture, Standing, Team } from "@/domain/types";
import { fixtureScore } from "@/domain/rules";
import { formatDate, formatTime } from "@/lib/format";
import { TeamLogo } from "./team-logo";
export function PageHeading({
  eyebrow,
  title,
  text,
  action,
  logoName,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: React.ReactNode;
  logoName?: string;
}) {
  return (
    <div className="page-heading">
      <div className="heading-identity">
        {logoName && <TeamLogo name={logoName} large />}
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="subtext">{text}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
export function StandingsTable({ rows, division, compact = false, ownLabel = "NOSOTROS" }: { rows: Standing[]; division?: string; compact?: boolean; ownLabel?: string }) {
  return (
    <div className="table-scroll">
      <table className={`standings ${compact ? "compact" : ""}`}>
        <thead>
          <tr>
            <th>POS.</th>
            <th>EQUIPO</th>
            <th>PJ</th>
            <th>V</th>
            <th>D</th>
            <th>PTS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.name} className={row.own ? "own-team" : ""}>
              <td>
                <span className="rank">{i + 1}</span>
              </td>
              <td>
                <Link href={row.teamId?`/competicion/equipos/${row.teamId}${division ? `?division=${division}` : ""}`:"/competicion"} className="standing-team">
                  <TeamLogo name={row.name} />
                  <span>
                    {row.name}
                    {row.own && <span className="you-badge">{ownLabel}</span>}
                  </span>
                </Link>
              </td>
              <td>{row.played}</td>
              <td>{row.won}</td>
              <td>{row.lost}</td>
              <td>
                <strong>{row.points}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function FixtureCard({
  fixture,
  team,
  prominent = false,
}: {
  fixture: Fixture;
  team: Team;
  prominent?: boolean;
}) {
  const score =
    fixture.score ? {home:fixture.score[0],away:fixture.score[1]} : fixture.status === "played" ? fixtureScore(fixture.matches) : null;
  const own = score && (fixture.home ? score.home : score.away);
  const rival = score && (fixture.home ? score.away : score.home);
  return (
    <Link
      href={`/equipos/${team.id}/jornadas/${fixture.id}`}
      className={`fixture-card ${prominent ? "prominent" : ""}`}
    >
      <div className="fixture-meta">
        <span>JORNADA {String(fixture.round).padStart(2, "0")}</span>
        <span className={`badge ${score ? "muted" : "blue"}`}>
          {score ? "Disputada" : "Pendiente"}
        </span>
      </div>
      <div className="fixture-versus">
        <div>
          <TeamLogo name={team.name} />
          <strong>Fito Raya {team.id.toUpperCase()}</strong>
        </div>
        <b>{score ? `${own} – ${rival}` : "VS"}</b>
        <div>
          <TeamLogo name={fixture.opponent} />
          <strong>{fixture.opponent}</strong>
        </div>
      </div>
      <div className="fixture-bottom">
        <span>
          <CalendarDays size={15} />
          {formatDate(fixture.date)} · {formatTime(fixture.date)}
        </span>
        <span>
          <MapPin size={15} />
          {fixture.home ? "Local" : "Visitante"}
        </span>
        <ArrowRight size={17} />
      </div>
    </Link>
  );
}
const MATCH_VALUES = [3, 3, 2, 2, 2];
function daysUntil(date: string) {
  const time = Date.parse(date);
  if (!date || Number.isNaN(time)) return null;
  const day = (value: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date(value));
  const diff = Math.round((Date.parse(day(time)) - Date.parse(day(Date.now()))) / 86400000);
  if (diff < 0) return null;
  return diff === 0 ? "Hoy" : diff === 1 ? "Mañana" : `Faltan ${diff} días`;
}
type BoardSide = { name: string; logo: string; info?: { position: number; points: number } };
export function MatchBoard({ label, meta, date, home, away, actions }: {
  label: string;
  meta: string;
  date: string;
  home: BoardSide;
  away: BoardSide;
  actions: React.ReactNode;
}) {
  const countdown = daysUntil(date);
  return (
    <section className="match-board" aria-label={label}>
      <div className="match-board-meta">
        <span>{meta}</span>
        <span>{countdown && <b>{countdown}</b>} {formatDate(date)} · {formatTime(date)}</span>
      </div>
      <div className="match-board-versus">
        {[home, away].map((side, index) => (
          <div className={`match-board-team ${index ? "is-away" : ""}`} key={index}>
            <TeamLogo name={side.logo} large />
            <div>
              <strong>{side.name}</strong>
              <span>{index ? "Visitante" : "Local"}{side.info && ` · ${side.info.position}º · ${side.info.points} pts`}</span>
            </div>
          </div>
        ))}
        <b className="match-board-vs" aria-hidden="true">VS</b>
      </div>
      <ol className="match-values" aria-label="Puntos en juego por pareja">
        {MATCH_VALUES.map((value, index) => (
          <li key={index} className={value === 3 ? "is-high" : ""}><b>{value}</b><span>Pareja {index + 1}</span></li>
        ))}
      </ol>
      <div className="match-board-actions">
        <span>12 puntos en juego. Las dos primeras parejas valen 3.</span>
        <div>{actions}</div>
      </div>
    </section>
  );
}
export function NextMatchBoard({ fixture, team, standing, opponentStanding }: {
  fixture: Fixture;
  team: Team;
  standing?: { position: number; points: number };
  opponentStanding?: { position: number; points: number };
}) {
  const ours = { name: `Fito Raya ${team.id.toUpperCase()}`, logo: team.name, info: standing };
  const theirs = { name: fixture.opponent.replaceAll("_", " "), logo: fixture.opponent, info: opponentStanding };
  const [home, away] = fixture.home ? [ours, theirs] : [theirs, ours];
  return (
    <MatchBoard
      label={`Próximo encuentro del equipo ${team.id.toUpperCase()}`}
      meta={`Jornada ${String(fixture.round).padStart(2, "0")} · ${team.division}`}
      date={fixture.date}
      home={home}
      away={away}
      actions={<>
        <Link className="text-link" href={`/equipos/${team.id}/jornadas/${fixture.id}`}>Ver jornada <ArrowRight size={16} /></Link>
        <Link className="button" href={`/equipos/${team.id}/parejas`}>Preparar la alineación</Link>
      </>}
    />
  );
}
export function ResultRow({ fixture, team }: { fixture: Fixture; team: Team }) {
  const score = fixture.score ? { home: fixture.score[0], away: fixture.score[1] } : fixtureScore(fixture.matches);
  const own = fixture.home ? score.home : score.away;
  const rival = fixture.home ? score.away : score.home;
  const outcome = own > rival ? "Victoria" : own < rival ? "Derrota" : null;
  return (
    <Link className="result-row" href={`/equipos/${team.id}/jornadas/${fixture.id}`}>
      <span className="result-round">J{String(fixture.round).padStart(2, "0")}</span>
      <TeamLogo name={fixture.opponent} />
      <span className="result-name"><strong>{fixture.home ? "vs" : "en"} {fixture.opponent.replaceAll("_", " ")}</strong><small>{formatDate(fixture.date)} · {fixture.home ? "Local" : "Visitante"}</small></span>
      <b className="result-score">{own}–{rival}</b>
      {outcome ? <span className={`result-outcome is-${outcome.toLowerCase()}`}>{outcome}</span> : <span aria-hidden="true" />}
    </Link>
  );
}

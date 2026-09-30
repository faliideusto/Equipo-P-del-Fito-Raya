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
export function StandingsTable({ rows }: { rows: Standing[] }) {
  return (
    <div className="table-scroll">
      <table className="standings">
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
                <Link href={row.teamId?`/competicion/equipos/${row.teamId}`:"/competicion"} className="standing-team">
                  <TeamLogo name={row.name} />
                  <span>
                    {row.name}
                    {row.own && <span className="you-badge">NOSOTROS</span>}
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

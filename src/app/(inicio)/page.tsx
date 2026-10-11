import Link from "next/link";
import { ArrowRight, CalendarDays, ListOrdered, Sparkles, Users } from "lucide-react";
import { clubRepository } from "@/data/repository";
import { NextMatchBoard, ResultRow } from "@/components/sports";
import { TeamLogo } from "@/components/team-logo";
import { formatDate, formatTime } from "@/lib/format";
export default async function Home() {
  const teams = await clubRepository.getTeams();
  const cards = await Promise.all(
    teams.map(async (team) => {
      const [players, rows, fixtures] = await Promise.all([
        clubRepository.getPlayers(team.id),
        clubRepository.getStandings(team.id),
        clubRepository.getFixtures(team.id),
      ]);
      const ownIndex = rows.findIndex((r) => r.own);
      const next = fixtures.find((f) => f.status === "pending");
      const opponentIndex = next ? rows.findIndex((r) => r.name.trim().toUpperCase() === next.opponent.trim().toUpperCase()) : -1;
      return {
        team,
        players,
        rows,
        own: rows[ownIndex],
        position: ownIndex + 1,
        next,
        opponent: opponentIndex >= 0 ? { position: opponentIndex + 1, points: rows[opponentIndex].points } : undefined,
        last: fixtures.filter((f) => f.status === "played").at(-1),
      };
    }),
  );
  const featured = [...cards].filter((c) => c.next).sort((a, b) => (Date.parse(a.next!.date) || Infinity) - (Date.parse(b.next!.date) || Infinity))[0];
  const others = cards.filter((c) => c !== featured && c.next);
  const results = cards.flatMap((c) => (c.last ? [{ team: c.team, fixture: c.last }] : []));
  return (
    <>
      <div className="home-heading">
        <div>
          <p className="eyebrow">Escuela Fito Raya · Series Nacionales de Pádel</p>
          <h1>Nos vemos en la pista.</h1>
        </div>
        <p className="subtext">El próximo partido, cómo va la liga y las parejas de la jornada, todo a mano.</p>
      </div>

      {featured ? (
        <NextMatchBoard
          fixture={featured.next!}
          team={featured.team}
          standing={featured.own ? { position: featured.position, points: featured.own.points } : undefined}
          opponentStanding={featured.opponent}
        />
      ) : (
        <section className="panel empty-state">
          <h2>No hay encuentros pendientes publicados.</h2>
          <p>Cuando SNP publique la próxima jornada aparecerá aquí.</p>
        </section>
      )}

      {others.map(({ team, next }) => (
        <Link key={team.id} className="next-strip" href={`/equipos/${team.id}/jornadas/${next!.id}`}>
          <span className="next-strip-team">Equipo {team.id.toUpperCase()} · J{String(next!.round).padStart(2, "0")}</span>
          <span className="next-strip-match">
            <TeamLogo name={next!.opponent} />
            {next!.home ? "Fito Raya " + team.id.toUpperCase() + " vs " + next!.opponent.replaceAll("_", " ") : next!.opponent.replaceAll("_", " ") + " vs Fito Raya " + team.id.toUpperCase()}
          </span>
          <span className="next-strip-date">{formatDate(next!.date)} · {formatTime(next!.date)}</span>
          <ArrowRight size={18} />
        </Link>
      ))}

      <div className="section-title">
        <h2>Nuestros equipos</h2>
        <span>Temporada 2026 / 27</span>
      </div>
      <div className="team-grid">
        {cards.map(({ team, players, own, position, rows }) => (
          <article className="team-card" key={team.id}>
            <Link className="team-card-top" href={`/equipos/${team.id}`}>
              <TeamLogo name={team.name} large />
              <div>
                <h3>Equipo {team.id.toUpperCase()}</h3>
                <p>{team.division}</p>
              </div>
              <ArrowRight size={18} />
            </Link>
            <dl className="team-stats">
              <div><dt>Puesto</dt><dd>{own ? `${position}º` : "—"}<small>/{rows.length}</small></dd></div>
              <div><dt>Puntos</dt><dd>{own?.points ?? "—"}</dd></div>
              <div><dt>Jugadores</dt><dd>{players.length}</dd></div>
            </dl>
            <nav className="team-card-links" aria-label={`Accesos del equipo ${team.id.toUpperCase()}`}>
              <Link href={`/equipos/${team.id}/jornadas`}><CalendarDays size={16} /> Jornadas</Link>
              <Link href={`/equipos/${team.id}/clasificacion`}><ListOrdered size={16} /> Clasificación</Link>
              <Link href={`/equipos/${team.id}/plantilla`}><Users size={16} /> Plantilla</Link>
              <Link href={`/equipos/${team.id}/parejas`} className="is-action"><Sparkles size={16} /> Crear parejas</Link>
            </nav>
          </article>
        ))}
      </div>

      {results.length > 0 && (
        <>
          <div className="section-title">
            <h2>Últimos resultados</h2>
            <span>Puntos por partido: 3 / 3 / 2 / 2 / 2</span>
          </div>
          <section className="panel result-list">
            {results.map(({ team, fixture }) => (
              <div key={team.id + fixture.id}>
                <span className="result-team">Equipo {team.id.toUpperCase()}</span>
                <ResultRow fixture={fixture} team={team} />
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}

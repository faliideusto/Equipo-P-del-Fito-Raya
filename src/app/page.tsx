import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Layers3,
  Trophy,
  Users,
  Sparkles,
} from "lucide-react";
import { clubRepository } from "@/data/repository";
import { FixtureCard, PageHeading } from "@/components/sports";
import { TeamLogo } from "@/components/team-logo";
export default async function Home() {
  const teams = await clubRepository.getTeams();
  const cards = await Promise.all(
    teams.map(async (team) => ({
      team,
      players: await clubRepository.getPlayers(team.id),
      rows: await clubRepository.getStandings(team.id),
      fixtures: await clubRepository.getFixtures(team.id),
    })),
  );
  return (
    <>
      <PageHeading
        eyebrow="TU CLUB, EN UN MISMO LUGAR"
        title="Nos vemos en la pista."
        text="Dos equipos. Una escuela. Todo listo para la próxima jornada."
      />
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-tag">
            <span className="status-dot" /> EL PARTIDO EMPIEZA AQUÍ
          </span>
          <h2>
            Un buen equipo.
            <br />
            Muchas posibilidades.
          </h2>
          <p>
            Encuentra tu pareja, prueba combinaciones
            <br className="desktop-only" /> y prepara la próxima alineación.
          </p>
          <Link href="/equipos/a/parejas" className="button light">
            Entrar al laboratorio <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="court-art" aria-hidden="true">
          <div className="court-line baseline" />
          <div className="court-line service-line one" />
          <div className="court-line service-line two" />
          <div className="court-net" />
          <div className="court-line center-line" />
          <div className="court-ball" />
          <span className="court-label">
            EL TALENTO SUMA.
            <br />
            EL EQUIPO MULTIPLICA.
          </span>
          <span className="court-coordinate">36.6866° N / 6.1370° W</span>
        </div>
      </section>
      <div className="section-title">
        <h2>
          Nuestros equipos <span>02</span>
        </h2>
        <span>Series Nacionales de Pádel · Future</span>
      </div>
      <div className="team-grid">
        {cards.map(({ team, players, rows }) => {
          const own = rows.find((r) => r.own)!;
          return (
            <article className="team-card" key={team.id}>
              <div className="team-card-top">
                <div className="team-card-identity">
                  <TeamLogo name={team.name} large />
                  <span className="team-letter">{team.id.toUpperCase()}</span>
                </div>
                <span className="badge">FUTURE</span>
              </div>
              <h3>{team.name}</h3>
              <p>{team.division}</p>
              <div className="team-stats">
                <div>
                  <Trophy size={17} />
                  <strong>
                    {rows.indexOf(own) + 1}
                    <small>º</small>
                  </strong>
                  <span>Clasificación</span>
                </div>
                <div>
                  <Users size={17} />
                  <strong>{players.length}</strong>
                  <span>Jugadores</span>
                </div>
                <div>
                  <Layers3 size={17} />
                  <strong>{own.points}</strong>
                  <span>Puntos de liga</span>
                </div>
              </div>
              <div className="team-card-actions">
                <Link href={`/equipos/${team.id}`} className="text-link">
                  Ver equipo <ArrowRight size={16} />
                </Link>
                <Link
                  href={`/equipos/${team.id}/parejas`}
                  className="button small"
                >
                  <Sparkles size={15} /> Crear parejas
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      <div className="section-title">
        <h2>El próximo encuentro</h2>
        <span>Una nueva oportunidad de sumar</span>
      </div>
      <div className="team-grid">
        {cards.map(({ team, fixtures }) => {
          const next = fixtures.find((f) => f.status === "pending");
          return (
            next && <FixtureCard key={team.id} fixture={next} team={team} />
          );
        })}
      </div>
    </>
  );
}

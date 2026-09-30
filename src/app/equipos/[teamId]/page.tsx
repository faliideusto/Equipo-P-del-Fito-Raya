import Link from "next/link";
import { ArrowUpRight, Trophy, Users, CalendarDays } from "lucide-react";
import { clubRepository } from "@/data/repository";
import type { TeamId } from "@/domain/types";
import { FixtureCard, PageHeading, StandingsTable } from "@/components/sports";
export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: TeamId }>;
}) {
  const { teamId } = await params;
  const team = (await clubRepository.getTeam(teamId))!;
  const [players, rows, fixtures] = await Promise.all([
    clubRepository.getPlayers(teamId),
    clubRepository.getStandings(teamId),
    clubRepository.getFixtures(teamId),
  ]);
  const own = rows.find((r) => r.own)!;
  const next = fixtures.find((f) => f.status === "pending");
  return (
    <>
      <PageHeading
        eyebrow={`${team.shortName} / ${team.division}`}
        title={team.name}
        logoName={team.name}
        text="Tu equipo, preparado para lo que viene."
        action={
          <Link className="button" href={`/equipos/${teamId}/parejas`}>
            Crear parejas <ArrowUpRight size={18} />
          </Link>
        }
      />
      <div className="summary-stats">
        <div>
          <Trophy />
          <span>Posición en liga</span>
          <strong>{rows.indexOf(own) + 1}º</strong>
        </div>
        <div>
          <Users />
          <span>Jugadores en plantilla</span>
          <strong>{players.length}</strong>
        </div>
        <div>
          <CalendarDays />
          <span>Jornadas disputadas</span>
          <strong>
            {own.played}
            <small> en SNP</small>
          </strong>
        </div>
      </div>
      <div className="section-title">
        <h2>Próxima jornada</h2>
        <Link href={`/equipos/${teamId}/jornadas`} className="text-link">
          Ver calendario <ArrowUpRight size={16} />
        </Link>
      </div>
      {next && <FixtureCard fixture={next} team={team} prominent />}
      <div className="section-title">
        <h2>Así va la liga</h2>
        <span>{team.division} · SNP</span>
      </div>
      <section className="panel">
        <StandingsTable rows={rows} />
      </section>
    </>
  );
}

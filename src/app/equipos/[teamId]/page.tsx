import Link from "next/link";
import { ArrowUpRight, Trophy, Users, CalendarDays } from "lucide-react";
import { clubRepository } from "@/data/repository";
import type { TeamId } from "@/domain/types";
import { PageHeading, StandingsTable } from "@/components/sports";
import { TeamSchedule } from "@/components/team-schedule";
import { fixtureScore } from "@/domain/rules";
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
  const sourceId = teamId === "a" ? "7778" : "803902";
  const division = teamId === "a" ? "2318" : "2326";
  const calendar = fixtures.map(f => ({
    id: f.id, round: f.round, date: f.date,
    homeId: f.home ? sourceId : "", awayId: f.home ? "" : sourceId,
    homeName: f.home ? team.name : f.opponent, awayName: f.home ? f.opponent : team.name,
    score: f.score || (f.status === "played" ? [fixtureScore(f.matches).home, fixtureScore(f.matches).away] as [number, number] : null),
    state: f.status,
  }));
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
      <TeamSchedule fixtures={calendar} teamId={sourceId} matchBaseHref={`/equipos/${teamId}/jornadas`}/>
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
        <h2>Así va la liga</h2>
        <span>{team.division} · SNP</span>
      </div>
      <section className="panel">
        <StandingsTable rows={rows} division={division} />
      </section>
    </>
  );
}

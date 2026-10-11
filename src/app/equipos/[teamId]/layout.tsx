import { notFound } from "next/navigation";
import { ClubDataNote } from "@/components/club-data-note";
import { TeamLogo } from "@/components/team-logo";
import { TeamSwitch, TeamTabs } from "@/components/team-tabs";
import { clubRepository } from "@/data/repository";
export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  if (teamId !== "a" && teamId !== "b") notFound();
  const team = (await clubRepository.getTeam(teamId))!;
  const rows = await clubRepository.getStandings(teamId);
  const ownIndex = rows.findIndex((row) => row.own);
  const own = rows[ownIndex];
  return (
    <>
      <header className="team-header">
        <div className="team-header-identity">
          <TeamLogo name={team.name} large />
          <div>
            <p className="eyebrow">Equipo {teamId.toUpperCase()} · {team.division}</p>
            <p className="team-header-name">{team.name}</p>
          </div>
        </div>
        <dl className="team-header-stats">
          <div><dt>Puesto</dt><dd>{own ? `${ownIndex + 1}º` : "—"}<small> de {rows.length}</small></dd></div>
          <div><dt>Puntos</dt><dd>{own?.points ?? "—"}</dd></div>
          <div><dt>V – D</dt><dd>{own ? `${own.won}–${own.lost}` : "—"}</dd></div>
        </dl>
        <TeamSwitch teamId={teamId} />
      </header>
      <TeamTabs teamId={teamId} />
      {children}
      <ClubDataNote teamId={teamId} />
    </>
  );
}

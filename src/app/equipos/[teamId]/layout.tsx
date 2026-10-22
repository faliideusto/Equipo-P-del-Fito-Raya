import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ClubDataNote } from "@/components/club-data-note";
import { TeamLogo } from "@/components/team-logo";
import { TeamSwitch, TeamTabs } from "@/components/team-tabs";
import { Skeleton } from "@/components/skeletons";
import { clubRepository } from "@/data/repository";
import type { TeamId } from "@/domain/types";
import { canPrepareRivals } from "@/lib/rival-preparation";
// The header shell renders at once; only the standings figures wait for SNP, so the
// subpage (and its own skeleton) never waits behind the team header.
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
        <Suspense fallback={<TeamStatsFallback />}><TeamStats teamId={teamId} /></Suspense>
        <TeamSwitch teamId={teamId} />
      </header>
      <Suspense fallback={<TeamTabs teamId={teamId} />}><PrivateTeamTabs teamId={teamId} /></Suspense>
      {children}
      <Suspense fallback={null}><ClubDataNote teamId={teamId} /></Suspense>
    </>
  );
}
async function PrivateTeamTabs({ teamId }: { teamId: TeamId }) {
  return <TeamTabs teamId={teamId} showHidden={await canPrepareRivals()} />;
}
async function TeamStats({ teamId }: { teamId: TeamId }) {
  const rows = await clubRepository.getStandings(teamId);
  const ownIndex = rows.findIndex((row) => row.own);
  const own = rows[ownIndex];
  return (
    <dl className="team-header-stats">
      <div><dt>Puesto</dt><dd>{own ? `${ownIndex + 1}º` : "—"}<small> de {rows.length}</small></dd></div>
      <div><dt>Puntos</dt><dd>{own?.points ?? "—"}</dd></div>
      <div><dt>V – D</dt><dd>{own ? `${own.won}–${own.lost}` : "—"}</dd></div>
    </dl>
  );
}
function TeamStatsFallback() {
  return (
    <dl className="team-header-stats" aria-busy="true">
      {["Puesto", "Puntos", "V – D"].map((label) => <div key={label}><dt>{label}</dt><dd><Skeleton className="skeleton-stat" /></dd></div>)}
    </dl>
  );
}

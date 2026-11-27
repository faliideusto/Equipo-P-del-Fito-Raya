import type { TeamId } from "@/domain/types";
import type { SnpFixture } from "@/domain/snp";
import { nextFixture, teamForm, uniqueFixtures, type FormEntry, type NextFixture } from "@/domain/league-table";
import { clubDivision } from "./club-division";
import { getSnpCompetition } from "./snp-service";

export interface LeagueExtras { form: Record<string, FormEntry[]>; next: Record<string, NextFixture | null> }

// Recent form and next encounter of every team in the club team's table. The form also reads the
// neighbouring divisions, so a team that moved after the retos keeps its first phase and its reto.
export async function leagueExtras(team: TeamId): Promise<LeagueExtras> {
  const division = await clubDivision(team);
  const current = await getSnpCompetition({ division }).catch(() => null);
  if (!current) return { form: {}, next: {} };
  const { divisions, standings, calendar } = current.data;
  const index = divisions.findIndex(d => d.id === division);
  const neighbours = index < 0 ? [] : [divisions[index - 1], divisions[index + 1]].filter(Boolean).map(d => d.id);
  const others = await Promise.all(neighbours.map(id => getSnpCompetition({ division: id }).then(r => r.data.calendar).catch(() => [] as SnpFixture[])));
  const fixtures = uniqueFixtures([...calendar, ...others.flat()]);
  const form: LeagueExtras["form"] = {}, next: LeagueExtras["next"] = {};
  for (const row of standings) {
    form[row.teamId] = teamForm(row.teamId, fixtures);
    next[row.teamId] = nextFixture(row.teamId, calendar);
  }
  return { form, next };
}

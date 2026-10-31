import { currentAccount } from "./account-auth";
import { playerLink } from "./account-profile";
import { getSnpCompetition, getSnpPlayer, getSnpTeam } from "./snp-service";
import { canOpenCayitos, cayitoMembers, cayitoStats, sameName, type CayitoMember, type CayitoStats } from "@/domain/cayitos";

type Access = { account: typeof currentAccount; link: (userId: string) => Promise<{ player_id: string } | null> };
const defaults: Access = { account: currentAccount, link: playerLink };
// Only the accounts linked to the three friends' SNP files: not the coach, captains or visitors.
export async function canSeeCayitos(deps: Access = defaults): Promise<boolean> {
  try {
    const user = await deps.account();
    if (user?.role === "cayito") return true;
    if (!user || user.role !== "player") return false;
    return canOpenCayitos((await deps.link(user.id))?.player_id);
  } catch { return false; }
}

// Tomás plays for Top Bal Pádel Game B, in the Fito A division. His SNP file is found by name
// in that team's roster (or in its actas), so nothing breaks if SNP renumbers the team.
const TOP_BAL_FALLBACK = "3343";
// Tomás's own team, for his menu: found by name in the Fito A division.
export async function topBalTeam(): Promise<string> {
  const standings = await getSnpCompetition({ division: "2318" }).then(result => result.data.standings).catch(() => []);
  return standings.find(row => /top\s*bal/i.test(row.name))?.teamId ?? TOP_BAL_FALLBACK;
}
async function findMember(member: CayitoMember): Promise<{ id: string; team: string } | null> {
  if (member.snpId) return { id: member.snpId, team: member.snpTeam ?? "" };
  if (!member.findName) return null;
  const standings = await getSnpCompetition({ division: "2318" }).then(result => result.data.standings).catch(() => []);
  const teamIds = [...new Set([...standings.filter(row => /top\s*bal/i.test(row.name)).map(row => row.teamId), TOP_BAL_FALLBACK])];
  for (const teamId of teamIds) {
    const team = await getSnpTeam(teamId).then(result => result.data).catch(() => null);
    const player = team?.players.find(player => sameName(player.name, member.findName!));
    if (player) return { id: player.id, team: teamId };
  }
  return null;
}

export async function loadCayitos(): Promise<CayitoStats[]> {
  return Promise.all(cayitoMembers.map(async member => {
    try {
      const found = await findMember(member);
      if (!found) return cayitoStats(member, null, "No se encontró su ficha en SNP.");
      const result = await getSnpPlayer(found.id, found.team || undefined);
      return { ...cayitoStats(member, result.data, result.data.statsError), snpTeam: found.team || null };
    } catch {
      return cayitoStats(member, null, "SNP no ha respondido. Vuelve a intentarlo en un rato.");
    }
  }));
}

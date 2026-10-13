import { clubRepository } from "@/data/repository";
import { loadSeasonRanking } from "@/lib/season-ranking-service";
import { getSnpMatch, getSnpPlayer } from "@/lib/snp-service";
import { savedAvailability } from "@/lib/fixture-availability";
import { lineups } from "@/lib/saved-lineups";
import { playerWinRates } from "@/domain/player-winrate";
import type { ChatData } from "./tools";

// The same sources the pages use, so the assistant never sees data the club cannot see on the web.
export const clubChatData: ChatData = {
  players: team => clubRepository.getPlayers(team),
  fixtures: team => clubRepository.getFixtures(team),
  standings: team => clubRepository.getStandings(team),
  ranking: async team => (await loadSeasonRanking(team)).rows,
  match: async id => (await getSnpMatch(id)).data,
  winRate: async player => {
    if (!player.sourceId) return null;
    try { const { data } = await getSnpPlayer(player.sourceId, player.sourceTeamId); return playerWinRates(data.stats, data.previousStats).current; }
    catch { return null; }
  },
  availability: (team, fixtureId) => savedAvailability(team, fixtureId),
  lineups: team => lineups(team, "list"),
};

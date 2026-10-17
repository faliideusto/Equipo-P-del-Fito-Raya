import { FifaCard, type CardStat } from "./fifa-card";
import { SquadCourt } from "./squad-court";
import { cardPhoto } from "@/data/player-photos";
import { pointsTier, sideShort } from "@/domain/squad";
import type { seasonRanking } from "@/domain/season-ranking";
import type { TeamId } from "@/domain/types";
import { isInForm } from "@/domain/mvp";

export type RankingRow = ReturnType<typeof seasonRanking>["rows"][number];

export const rankingStats = (row: RankingRow): CardStat[] => [
  { label: "PJ", value: row.played }, { label: "GAN", value: row.won }, { label: "PER", value: row.lost },
  { label: "SG", value: row.setsWon }, { label: "SP", value: row.setsLost }, { label: "DIF", value: row.setsWon - row.setsLost > 0 ? `+${row.setsWon - row.setsLost}` : row.setsWon - row.setsLost },
];

export const playerHref = (row: RankingRow, teamId: TeamId) =>
  `/competicion/jugadores/${row.player.sourceId ?? row.player.id}?equipo=${row.player.sourceTeamId ?? (teamId === "a" ? "7778" : "803902")}`;

export function SeasonRankingCards({ rows, teamId, teamName, inForm = [] }: { rows: RankingRow[]; teamId: TeamId; teamName: string; inForm?: string[] }) {
  return <SquadCourt
    ranked={rows}
    keyOf={row => row.player.id}
    label={`Ranking del ${teamName} sobre la pista, por puntos aportados al equipo`}
    benchLabel="Ordenados por puntos SNP"
    benchOrder={(a, b) => (b.player.points ?? -1) - (a.player.points ?? -1)}
    card={row => <FifaCard name={row.player.name} nickname={row.player.nickname} photoUrl={cardPhoto(row.player)} rating={String(row.points)} ratingLabel="PTS"
      badge={sideShort(row.player.position)} tier={isInForm(row.player, inForm) ? "if" : pointsTier(row.player.points)} href={playerHref(row, teamId)} stats={rankingStats(row)}/>}
  />;
}

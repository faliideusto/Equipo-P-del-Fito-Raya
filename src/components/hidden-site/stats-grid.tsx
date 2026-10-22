import { formatWinRate } from "@/lib/format";
import type { LineupPlayer } from "./types";
import type { PlayerStats } from "./use-player-stats";

// Total winrate, won-lost matches and sets of the player's whole SNP history.
export function StatsGrid({ player, stats }: { player: LineupPlayer; stats?: PlayerStats }) {
  if (!player.snpId) return <small className="hs-stats">Sin historial en SNP</small>;
  if (!stats) return <small className="hs-stats is-loading" aria-label="Cargando estadísticas"><i/><i/><i/></small>;
  const rate = stats.rate;
  if (!rate) return <small className="hs-stats">Estadísticas no disponibles</small>;
  return <dl className="hs-stats">
    <div className="is-rate"><dt>Winrate</dt><dd>{formatWinRate(rate.percentage)}</dd></div>
    <div><dt>Partidos</dt><dd>{rate.won}-{rate.lost}</dd></div>
    <div><dt>Sets</dt><dd>{rate.setsWon !== undefined ? `${rate.setsWon}-${rate.setsLost}` : "—"}</dd></div>
  </dl>;
}

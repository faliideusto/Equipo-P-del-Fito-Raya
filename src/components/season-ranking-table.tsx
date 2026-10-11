"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlayerAvatar } from "./player-avatar";
import { formatWinRate } from "@/lib/format";
import type { seasonRanking } from "@/domain/season-ranking";
import type { SnpPlayerProfile, SnpResult } from "@/domain/snp";
import type { TeamId } from "@/domain/types";

type Row = ReturnType<typeof seasonRanking>["rows"][number];
type Rates = { winRates?: SnpPlayerProfile["winRates"]; note?: string };

export function SeasonRankingTable({ rows, teamId }: { rows: Row[]; teamId: TeamId }) {
  const [rates, setRates] = useState<Record<string, Rates>>({});

  useEffect(() => {
    const controller = new AbortController();
    async function update() {
      // Load the profiles in small batches so the ranking appears immediately
      // and the SNP connection is not flooded with the entire roster at once.
      for (let offset = 0; offset < rows.length && !controller.signal.aborted; offset += 3) {
        await Promise.all(rows.slice(offset, offset + 3).map(async ({ player }) => {
          const id = player.sourceId ?? player.id;
          const sourceTeam = player.sourceTeamId ?? (teamId === "a" ? "7778" : "803902");
          let value: Rates;
          try {
            const response = await fetch(`/api/snp/players/${encodeURIComponent(id)}?team=${sourceTeam}`, { signal: controller.signal });
            if (!response.ok) throw new Error("No se pudo consultar el winrate.");
            const result: SnpResult<SnpPlayerProfile> = await response.json();
            value = { winRates: result.data.winRates, note: result.data.winRatesError ?? (result.stale ? "Últimos datos guardados de SNP." : undefined) };
          } catch {
            value = { note: "Winrate no disponible. Vuelve a cargar la página para reintentar." };
          }
          if (!controller.signal.aborted) setRates(current => ({ ...current, [player.id]: value }));
        }));
      }
    }
    void update();
    return () => controller.abort();
  }, [rows, teamId]);

  function winRateCell(playerId: string, period: "current" | "total") {
    const result = rates[playerId];
    const rate = result?.winRates?.[period];
    const description = !result ? "Consultando winrate…" : result.note ?? (rate ? rate.decided ? `${rate.won} ganados y ${rate.lost} perdidos, en todos los grupos SNP.` : "Sin partidos con resultado." : "Historial SNP no disponible.");
    const value = !result ? "…" : formatWinRate(rate?.percentage ?? null);
    return <td title={description}><span aria-label={`${value}. ${description}`}>{value}</span></td>;
  }

  return <div className="table-scroll"><table className="standings">
    <caption className="sr-only">Estadísticas de jugadores de la temporada actual y winrate del historial SNP disponible</caption>
    <thead><tr><th>POS.</th><th>JUGADOR</th><th>PTS EQUIPO</th><th>PJ</th><th>GANADOS</th><th>PERDIDOS</th><th>WINRATE TEMPORADA</th><th>WINRATE TOTAL</th><th>SETS GANADOS</th><th>SETS PERDIDOS</th></tr></thead>
    <tbody>{rows.map((row, i) => <tr key={row.player.id}>
      <td><span className="rank">{i + 1}</span></td>
      <td><Link className="standing-team" href={`/competicion/jugadores/${row.player.sourceId ?? row.player.id}?equipo=${row.player.sourceTeamId ?? (teamId === "a" ? "7778" : "803902")}`}><PlayerAvatar name={row.player.name} photoUrl={row.player.photoUrl ?? null} small/><span>{row.player.name}</span></Link></td>
      <td><strong>{row.points}</strong></td><td>{row.played}</td><td>{row.won}</td><td>{row.lost}</td>
      {winRateCell(row.player.id, "current")}{winRateCell(row.player.id, "total")}
      <td>{row.setsWon}</td><td>{row.setsLost}</td>
    </tr>)}</tbody>
  </table></div>;
}

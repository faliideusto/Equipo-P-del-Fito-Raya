import type { SnpPlayerProfile } from "@/domain/snp";
import { formatWinRate } from "@/lib/format";

export function PlayerWinRates({ player }: { player: SnpPlayerProfile }) {
  const metrics = [
    { label: "Winrate total", rate: player.winRates?.total },
    { label: "Winrate temporada actual", rate: player.winRates?.current },
  ];
  return <section className="panel player-stats" aria-label="Porcentaje de victorias">
    <div className="panel-heading"><h2>Porcentaje de victorias</h2><span className="badge blue">Todos los grupos</span></div>
    <div className="profile-metrics player-winrates">{metrics.map(({ label, rate }) => <div key={label}>
      <span>{label}</span>
      <strong>{formatWinRate(rate?.percentage ?? null)}</strong>
      <span>{rate ? rate.decided ? `${rate.won} ganados · ${rate.lost} perdidos · ${rate.decided} con resultado` : "Sin partidos con resultado" : "Datos no disponibles"}</span>
    </div>)}</div>
    <p className="data-note account-stat-note">Victorias / partidos con resultado. El total suma el historial disponible en SNP: temporada actual y anterior. SNP no proporciona temporadas más antiguas en esta ficha.</p>
    {player.winRatesError && <p className="snp-warning" role="status">{player.winRatesError}</p>}
  </section>;
}

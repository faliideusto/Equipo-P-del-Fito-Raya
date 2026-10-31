"use client";
import Link from "next/link";
import { useState } from "react";
import { Crown, Flame, Snowflake, TrendingDown, TrendingUp } from "lucide-react";
import { PlayerAvatar } from "./player-avatar";
import { crowns, sortCayitos, type CayitoSort, type CayitoStats } from "@/domain/cayitos";

const sorts: { id: CayitoSort; label: string }[] = [
  { id: "points", label: "Puntos SNP" },
  { id: "winRate", label: "Winrate" },
  { id: "sets", label: "Sets" },
  { id: "season", label: "Temporada" },
  { id: "streak", label: "Racha" },
];
const number = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const pct = (value: number | null) => value === null ? "—" : `${Math.round(value)}%`;
const signed = (value: number) => value > 0 ? `+${value}` : String(value);
const firstName = (name: string) => name.split(" ")[0];
const href = (row: CayitoStats) => row.snpId ? `/competicion/jugadores/${row.snpId}${row.snpTeam ? `?equipo=${row.snpTeam}` : ""}` : null;

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${28 - ((value - min) / span) * 24}`).join(" ");
  const up = values.at(-1)! >= values[0];
  return <svg className={`cayito-spark ${up ? "up" : "down"}`} viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label={`Evolución de los puntos SNP esta temporada: de ${number.format(values[0])} a ${number.format(values.at(-1)!)}`}><polyline points={points} vectorEffect="non-scaling-stroke"/></svg>;
}

function StreakBadge({ row }: { row: CayitoStats }) {
  if (!row.streak) return <span className="cayito-streak">—</span>;
  const win = row.streak.type === "W";
  return <span className={`cayito-streak ${win ? "win" : "loss"}`}>{win ? <Flame size={14}/> : <Snowflake size={14}/>}{row.streak.count} {win ? (row.streak.count === 1 ? "victoria" : "victorias") : (row.streak.count === 1 ? "derrota" : "derrotas")}</span>;
}

function Card({ row, rank, crowned }: { row: CayitoStats; rank: number; crowned: string[] }) {
  const link = href(row);
  const name = <h3>{row.name}</h3>;
  return (
    <article className={`cayito-card ${rank === 1 ? "leader" : ""}`}>
      <header>
        <span className="cayito-rank">{rank}</span>
        <PlayerAvatar name={row.name} photoUrl={row.photoUrl}/>
        <div className="cayito-who">
          {link ? <Link href={link}>{name}</Link> : name}
          <small>{row.nationalRank ? `Ranking nacional #${row.nationalRank}` : "Sin ranking nacional"}</small>
          {crowned.length > 0 && <div className="cayito-crowns">{crowned.map(label => <span key={label}><Crown size={12}/>{label}</span>)}</div>}
        </div>
        <div className="cayito-points">
          <strong>{row.points ? number.format(row.points) : "—"}</strong>
          <small>Puntos SNP</small>
          {row.trend !== null && Math.round(row.trend) !== 0 && <span className={row.trend > 0 ? "up" : "down"}>{row.trend > 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}{signed(Math.round(row.trend))}</span>}
        </div>
      </header>
      {row.error && !row.played ? <p className="cayito-error">{row.error}</p> : <>
        <div className="cayito-winrate" aria-label={`Winrate total ${pct(row.winRate)}`}>
          <div><span>Winrate total</span><b>{pct(row.winRate)}</b></div>
          <div className="cayito-bar"><i style={{ width: `${row.winRate ?? 0}%` }}/></div>
        </div>
        <dl className="cayito-stats">
          <div><dt>Partidos</dt><dd>{row.played}</dd></div>
          <div><dt>Ganados</dt><dd className="good">{row.won}</dd></div>
          <div><dt>Perdidos</dt><dd className="bad">{row.lost}</dd></div>
          <div><dt>Sets G-P</dt><dd>{row.setsWon}-{row.setsLost}</dd></div>
          <div><dt>Dif. sets</dt><dd className={row.setsWon - row.setsLost >= 0 ? "good" : "bad"}>{signed(row.setsWon - row.setsLost)}</dd></div>
          <div><dt>% sets</dt><dd>{pct(row.setRate)}</dd></div>
          <div><dt>Temporada</dt><dd>{row.season.won}-{row.season.lost} <small>{pct(row.season.winRate)}</small></dd></div>
          <div><dt>Mejor racha</dt><dd>{row.bestStreak ? `${row.bestStreak} V` : "—"}</dd></div>
          <div><dt>Máximo</dt><dd>{row.peak ? number.format(row.peak) : "—"}</dd></div>
        </dl>
        <footer>
          <div className="cayito-form">
            <StreakBadge row={row}/>
            <span className="cayito-last" aria-label={`Últimos partidos: ${row.last.map(r => r === "W" ? "victoria" : "derrota").join(", ") || "ninguno"}`}>{row.last.map((result, index) => <i key={index} className={result === "W" ? "w" : "l"}>{result === "W" ? "V" : "D"}</i>)}</span>
          </div>
          <Sparkline values={row.history}/>
        </footer>
      </>}
    </article>
  );
}

// Every stat side by side; the best value of each row is highlighted.
function Compare({ rows }: { rows: CayitoStats[] }) {
  const lines: { label: string; show: (row: CayitoStats) => string; score: (row: CayitoStats) => number | null }[] = [
    { label: "Puntos SNP", show: row => row.points ? number.format(row.points) : "—", score: row => row.points },
    { label: "Winrate total", show: row => pct(row.winRate), score: row => row.winRate },
    { label: "Partidos", show: row => String(row.played), score: row => row.played },
    { label: "Ganados", show: row => String(row.won), score: row => row.won },
    { label: "Perdidos", show: row => String(row.lost), score: row => row.played ? -row.lost : null },
    { label: "Sets ganados", show: row => String(row.setsWon), score: row => row.setsWon },
    { label: "Sets perdidos", show: row => String(row.setsLost), score: row => row.played ? -row.setsLost : null },
    { label: "Dif. sets", show: row => signed(row.setsWon - row.setsLost), score: row => row.played ? row.setsWon - row.setsLost : null },
    { label: "% sets", show: row => pct(row.setRate), score: row => row.setRate },
    { label: "Winrate temporada", show: row => pct(row.season.winRate), score: row => row.season.winRate },
    { label: "Mejor racha", show: row => row.bestStreak ? `${row.bestStreak} V` : "—", score: row => row.bestStreak || null },
    { label: "Máximo SNP", show: row => row.peak ? number.format(row.peak) : "—", score: row => row.peak },
  ];
  return (
    <section className="panel cayito-compare">
      <div className="panel-heading"><h2>Cara a cara</h2></div>
      <div className="cayito-table-wrap">
        <table>
          <thead><tr><th scope="col"><span className="sr-only">Estadística</span></th>{rows.map(row => <th scope="col" key={row.key}>{firstName(row.name)}</th>)}</tr></thead>
          <tbody>{lines.map(line => {
            const scores = rows.map(line.score).filter((value): value is number => value !== null);
            const best = scores.length ? Math.max(...scores) : null;
            return <tr key={line.label}><th scope="row">{line.label}</th>{rows.map(row => <td key={row.key} className={best !== null && line.score(row) === best ? "best" : ""}>{line.show(row)}</td>)}</tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  );
}

export function CayitosRanking({ rows, updatedAt }: { rows: CayitoStats[]; updatedAt: string }) {
  const [sort, setSort] = useState<CayitoSort>("points");
  const sorted = sortCayitos(rows, sort);
  const crown = crowns(rows);
  const labels = (row: CayitoStats) => [
    crown.points === row.key && "Rey de puntos",
    crown.winRate === row.key && "Mejor winrate",
    crown.sets === row.key && "Más sets",
    crown.streak === row.key && "En racha",
  ].filter((label): label is string => Boolean(label));
  return (
    <>
      <div className="cayito-sorts" role="tablist" aria-label="Ordenar ranking por">
        {sorts.map(option => <button key={option.id} type="button" role="tab" aria-selected={sort === option.id} className={sort === option.id ? "active" : ""} onClick={() => setSort(option.id)}>{option.label}</button>)}
      </div>
      <div className="cayito-grid">
        {sorted.map((row, index) => <Card key={row.key} row={row} rank={index + 1} crowned={labels(row)}/>)}
      </div>
      <Compare rows={sorted}/>
      <p className="cayito-note">Winrate, partidos y sets cuentan todo el historial SNP (esta temporada y la anterior, en todos los grupos). «Temporada» es solo la actual. Datos de SNP del {new Date(updatedAt).toLocaleString("es-ES", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}.</p>
    </>
  );
}

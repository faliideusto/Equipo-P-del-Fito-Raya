import type { ReactNode } from "react";
import { squadLayout } from "@/domain/squad";

// Padel court seen from above, with the match-day pairs laid out two per row.
export function SquadCourt<T>({ ranked, benchOrder, card, keyOf, label, benchLabel }: {
  ranked: T[]; benchOrder?: (a: T, b: T) => number; card: (item: T, rank: number) => ReactNode; keyOf: (item: T) => string;
  label: string; benchLabel: string;
}) {
  const { pairs, bench } = squadLayout(ranked, benchOrder);
  const rows = [pairs.slice(0, 2), pairs.slice(2, 4), pairs.slice(4)].filter(row => row.length);
  return <div className="squad">
    <section className="padel-court" aria-label={label}>
      <span className="court-lines" aria-hidden="true"><i className="court-service top"/><i className="court-net"/><i className="court-service bottom"/><i className="court-center"/></span>
      {rows.map(row => <div className="court-row" key={row[0].index}>
        {row.map(pair => <section className="court-pair" key={pair.index} aria-label={`Pareja ${pair.index + 1}, ${pair.value} puntos`}>
          <h3>Pareja {pair.index + 1} <small>{pair.value} pts</small></h3>
          <div>{pair.players.map((item, i) => <div key={keyOf(item)} className="court-slot">{card(item, pair.index * 2 + i + 1)}</div>)}</div>
        </section>)}
      </div>)}
    </section>
    {bench.length > 0 && <section className="squad-bench" aria-label="Suplentes">
      <h3>Suplentes <small>{benchLabel}</small></h3>
      <div className="bench-row">{bench.map(item => <div key={keyOf(item)} className="court-slot">{card(item, ranked.indexOf(item) + 1)}</div>)}</div>
    </section>}
  </div>;
}

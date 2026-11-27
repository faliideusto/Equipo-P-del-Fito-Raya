import Link from "next/link";
import type { Standing } from "@/domain/types";
import { roundLabel, shortTeamName, signed, type FormEntry, type NextFixture } from "@/domain/league-table";
import { TeamLogo } from "./team-logo";

const FORM_CLASS = { V: "win", D: "loss", E: "draw" } as const;
const FORM_TITLE = { V: "Victoria", D: "Derrota", E: "Empate" } as const;

// The full league table of the Clasificación tab: wins and losses, games difference, the last five
// encounters and the next one. On phones the extra columns fold under each team name.
export function LeagueTable({ rows, division, form, next }: {
  rows: Standing[];
  division?: string;
  form: Record<string, FormEntry[]>;
  next: Record<string, NextFixture | null>;
}) {
  return (
    <section className="panel league-panel">
      <table className="league-table">
        <thead>
          <tr>
            <th>#</th>
            <th className="lt-left">EQUIPO</th>
            <th>V – D</th>
            <th>DIF. JUEGOS</th>
            <th>ÚLTIMOS 5</th>
            <th className="lt-left">PRÓXIMO</th>
            <th>PTS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const id = row.teamId ?? "";
            const entries = form[id] ?? [];
            const upcoming = next[id] ?? null;
            const record = <WinLoss row={row} />;
            const difference = <Difference row={row} />;
            return (
              <tr key={row.name} className={row.own ? "lt-own" : undefined}>
                <td className="lt-pos">{i + 1}</td>
                <td className="lt-team-cell">
                  <Link href={row.teamId ? `/competicion/equipos/${row.teamId}${division ? `?division=${division}` : ""}` : "/competicion"} className="lt-team">
                    <TeamLogo name={row.name} />
                    <span className="lt-name">
                      {row.name}
                      {row.own && <span className="lt-you">NOSOTROS</span>}
                    </span>
                  </Link>
                  <div className="lt-mobile">
                    <Form entries={entries} />
                    <span className="lt-meta">{record}{difference}</span>
                  </div>
                  <div className="lt-mobile"><Next next={upcoming} /></div>
                </td>
                <td className="lt-desktop">{record}</td>
                <td className="lt-desktop">{difference}</td>
                <td className="lt-desktop"><Form entries={entries} scores /></td>
                <td className="lt-desktop lt-left"><Next next={upcoming} /></td>
                <td className="lt-pts">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="lt-legend">
        <span>Últimos 5: el más reciente a la derecha, incluye 1ª fase y retos</span>
        <span>Dif. juegos: desempata a igualdad de puntos</span>
      </p>
      {(rows.some(row => row.provisional) || Object.values(form).some(entries => entries.some(entry => entry.provisional))) && <p className="lt-legend">* Incluye enfrentamientos ya jugados que SNP todavía no ha cerrado, con los sets del acta y los resultados de la app. Provisional hasta que SNP publique.</p>}
    </section>
  );
}

function WinLoss({ row }: { row: Standing }) {
  return (
    <span className="lt-record" aria-label={`${row.won} victorias, ${row.lost} derrotas`}>
      <span className="lt-v">{row.won}</span><span className="lt-sep">–</span><span className="lt-d">{row.lost}</span>
      {row.provisional && <span title="Incluye un resultado provisional">*</span>}
    </span>
  );
}

function Difference({ row }: { row: Standing }) {
  const value = row.gameDifference;
  if (!row.played || value === undefined) return <span className="lt-dif zero">—</span>;
  return <span className={`lt-dif ${value > 0 ? "plus" : value < 0 ? "minus" : "zero"}`}>{signed(value)}</span>;
}

function Form({ entries, scores = false }: { entries: FormEntry[]; scores?: boolean }) {
  if (!entries.length) return <span className="lt-dif zero">—</span>;
  return (
    <span className="lt-form">
      {entries.map(entry => (
        <span key={entry.fixtureId} className={`lt-chip ${FORM_CLASS[entry.result]}${entry.provisional ? " provisional" : ""}`} title={`${FORM_TITLE[entry.result]} ${entry.own}-${entry.rival}${entry.provisional ? " · provisional, SNP aún no lo ha cerrado" : ""}`}>
          <b>{entry.result}</b>
          {scores && <em>{entry.own}-{entry.rival}{entry.provisional && "*"}</em>}
        </span>
      ))}
    </span>
  );
}

function Next({ next }: { next: NextFixture | null }) {
  if (!next) return <span className="lt-next rest">—</span>;
  if (next.kind === "rest") return <span className="lt-next rest">Descansa</span>;
  return (
    <span className="lt-next">
      <TeamLogo name={next.rivalName} />
      <span>
        <b>{next.home ? "vs" : "en"} {shortTeamName(next.rivalName)}</b>
        <small>{roundLabel(next.round, next.date)}</small>
      </span>
    </span>
  );
}

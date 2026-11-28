import { AlertTriangle, CheckCircle2, CloudDownload } from "lucide-react";
import type { LineupFromPoints } from "@/domain/snp-lineup-points";
import { formatPoints } from "@/lib/format";

type Player = { id: string; name: string; points: number | null };

// A team's lineup as SNP's acta shows it, rebuilt from the points of each player: every pair with its
// players, the tied players to choose from and the points nobody in the roster has.
// In the hidden site it also compares with the saved lineup (hasSaved, changes) and can load it (onUse);
// in the lineup checker it only shows it.
export function SnpLineupPanel({ fromSnp, teamName, players, changes = [], hasSaved, showUse = false, onUse }: {
  fromSnp: LineupFromPoints | null; teamName: string; players: Player[];
  changes?: number[]; hasSaved?: boolean; showUse?: boolean; onUse?: () => void;
}) {
  if (!fromSnp) return null;
  const checking = hasSaved === undefined;
  if (fromSnp.status === "none") return <section className="hs-snp is-none">
    <span className="hs-snp-icon"><CloudDownload size={18}/></span>
    <div><strong>{teamName} aún no ha metido su alineación en SNP</strong><small>{checking ? "El acta no tiene puntos de sus jugadores." : "Se vuelve a mirar cada vez que entras aquí."}</small></div>
  </section>;
  const name = (id: string) => players.find(player => player.id === id)?.name ?? "Jugador";
  const points = (id: string) => players.find(player => player.id === id)?.points ?? 0;
  const ties = fromSnp.ties.length;
  const state = changes.length ? "is-changed" : hasSaved || (checking && !ties && !fromSnp.missing.length) ? "is-match" : "is-new";
  const pill = checking ? (ties ? `${ties} ${ties === 1 ? "empate" : "empates"}` : fromSnp.missing.length ? "Incompleta" : "Sin dudas")
    : changes.length ? "Ha cambiado" : hasSaved ? "Coincide con la guardada" : "Sin guardar";
  const list = (pairs: number[]) => pairs.map(n => `P${n}`).join(", ").replace(/, (P\d)$/, " y $1");
  return <section className={`hs-snp ${state}`}>
    <header>
      <span className="hs-snp-icon"><CloudDownload size={18}/></span>
      <div><strong>{checking ? "Alineación por puntos" : `Alineación de ${teamName} en SNP`}</strong><small>Sacada de los puntos de cada jugador en el acta.</small></div>
      <span className="hs-snp-pill">{changes.length || (checking && ties) ? <AlertTriangle size={14}/> : state === "is-match" ? <CheckCircle2 size={14}/> : null}{pill}</span>
    </header>
    {changes.length > 0 && <p className="hs-snp-alert"><AlertTriangle size={16}/><span><b>Han cambiado la alineación.</b> No coincide con la guardada en {changes.length === 1 ? "la" : "las"} {list(changes)}.</span></p>}
    <ol className="hs-snp-pairs">{fromSnp.pairs.map((pair, index) => {
      const n = index + 1;
      return <li key={pair.id} className={changes.includes(n) ? "is-changed" : ""}>
        <span className="hs-pair-number">P{n}</span>
        {pair.players.map((id, slot) => {
          const tie = fromSnp.ties.find(item => item.pair === n && item.slot === slot);
          const miss = fromSnp.missing.find(item => item.pair === n && item.slot === slot);
          // Points with candidates who are all placed in other pairs, or points nobody in the roster has.
          const taken = fromSnp.options[index]?.[slot] ?? [];
          if (!id) return <div key={slot} className="hs-snp-player is-empty">
            <span>{miss ? "Jugador sin identificar" : "Sin datos"}</span>
            {miss && <small>{formatPoints(miss.points)} pts · {taken.length ? `con esos puntos solo ${taken.map(name).join(" o ")}, ya en otra pareja` : "nadie de la plantilla los tiene"}</small>}
          </div>;
          return <div key={slot} className={`hs-snp-player${tie ? " is-tie" : ""}`}>
            <span>{name(id)}</span>
            <small>{formatPoints(points(id))} pts</small>
            {tie && <small className="hs-snp-tie">Empate: o {tie.candidates.filter(other => other !== id).map(name).join(", ")}</small>}
          </div>;
        })}
      </li>;
    })}</ol>
    {(showUse || ties > 0) && <footer>
      {ties > 0 && <small>Si hay empate de puntos no se sabe cuál de ellos juega: {checking ? "se pone uno y se listan los demás." : "se pone uno y puedes cambiarlo."}</small>}
      {showUse && onUse && <button type="button" className="button small" onClick={onUse}><CloudDownload size={16}/> Usar la de SNP</button>}
    </footer>}
  </section>;
}

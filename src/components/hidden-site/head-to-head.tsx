"use client";
import Link from "next/link";
import { IdCard } from "lucide-react";
import type { Pair } from "@/domain/types";
import { forecast, headToHead, POINTS_TO_WIN, type Edge } from "@/domain/head-to-head";
import { PlayerAvatar } from "@/components/player-avatar";
import { formatPoints, formatWinRate } from "@/lib/format";
import type { LineupPlayer } from "./types";
import type { PlayerStats } from "./use-player-stats";
import { StatsGrid } from "./stats-grid";

type Side = { name: string; players: LineupPlayer[]; pairs: Pair[]; profile: (player: LineupPlayer) => string | null };
const edgeLabel = (edge: Edge, diff: number) => ({
  own: `Favoritos · +${formatPoints(diff)}`,
  rival: `Rival favorito · +${formatPoints(diff)}`,
  even: "Igualado",
  unknown: "Falta completar",
})[edge];

// Our pair N against the rival's pair N, with the forecast if every favourite wins.
export function HeadToHead({ own, rival, stats }: { own: Side; rival: Side; stats: Record<string, PlayerStats> }) {
  const find = (side: Side, id: string) => side.players.find(player => player.id === id);
  const matchups = headToHead(own.pairs, id => find(own, id)?.points, rival.pairs, id => find(rival, id)?.points);
  const result = forecast(matchups);
  const missing = POINTS_TO_WIN - result.own;
  const verdict = result.verdict === "own"
    ? `Si se cumplen los favoritos, ganamos ${result.own}–${result.rival}.`
    : result.verdict === "rival"
      ? `El rival parte con ventaja: nos hacen falta ${missing} pts y solo hay ${result.open} igualados. Toca dar alguna sorpresa o cambiar los cruces.`
      : `Nos faltan ${missing} pts para ganar y hay ${result.open} pts igualados en juego.`;
  return <div className="hs-h2h">
    <section className={`hs-board is-${result.verdict}`} aria-label="Marcador previsto">
      <p className="hs-board-label">Marcador previsto</p>
      <div className="hs-score">
        <div className="is-own"><span>{own.name}</span><strong>{result.own}</strong></div>
        <span className="hs-score-sep">–</span>
        <div className="is-rival"><span>{rival.name}</span><strong>{result.rival}</strong></div>
      </div>
      <div className="hs-score-bar" aria-hidden="true">{matchups.map(m => <span key={m.index} className={`is-${m.edge}`} style={{ flexGrow: m.value }}>P{m.index + 1}</span>)}</div>
      <p className="hs-verdict">{verdict}</p>
      <p className="hs-legend"><span className="is-own">Favoritos</span><span className="is-even">Igualado (±5 %)</span><span className="is-rival">Rival favorito</span></p>
    </section>
    <div className="hs-matches">{matchups.map(m => {
      const share = m.ownPoints !== null && m.rivalPoints !== null && m.ownPoints + m.rivalPoints > 0 ? m.ownPoints / (m.ownPoints + m.rivalPoints) * 100 : 50;
      return <article key={m.index} className={`hs-match is-${m.edge}`}>
        <header>
          <span className="hs-pair-number">P{m.index + 1}</span>
          <span className="hs-pair-value">{m.value} pts</span>
          <span className={`hs-edge is-${m.edge}`}>{edgeLabel(m.edge, Math.abs((m.ownPoints ?? 0) - (m.rivalPoints ?? 0)))}</span>
        </header>
        <div className="hs-balance" aria-label={`${Math.round(share)} % de los puntos SNP del cruce son nuestros`}><span style={{ width: `${share}%` }}/></div>
        <div className="hs-sides">
          <PairSide side={own} pair={m.own} total={m.ownPoints} stats={stats} kind="own"/>
          <span className="hs-vs" aria-hidden="true">VS</span>
          <PairSide side={rival} pair={m.rival} total={m.rivalPoints} stats={stats} kind="rival"/>
        </div>
      </article>;
    })}</div>
  </div>;
}

function PairSide({ side, pair, total, stats, kind }: { side: Side; pair: Pair | null; total: number | null; stats: Record<string, PlayerStats>; kind: "own" | "rival" }) {
  const members = (pair?.players ?? [null, null]).map(id => id ? side.players.find(player => player.id === id) ?? null : null);
  const rates = members.map(player => player && stats[player.id]?.rate).filter(rate => rate != null);
  const won = rates.reduce((n, rate) => n + rate.won, 0); const decided = rates.reduce((n, rate) => n + rate.decided, 0);
  return <div className={`hs-side is-${kind}`}>
    <div className="hs-side-head"><span>{side.name}</span><b>{total !== null ? `${formatPoints(total)} pts` : "—"}</b>{rates.length === 2 && <small>WR pareja {formatWinRate(decided ? won / decided * 100 : null)}</small>}</div>
    {members.map((player, slot) => player ? <PlayerRow key={slot} player={player} stats={stats[player.id]} href={side.profile(player)}/> : <p key={slot} className="hs-player is-missing">Sin jugador</p>)}
  </div>;
}

function PlayerRow({ player, stats, href }: { player: LineupPlayer; stats?: PlayerStats; href: string | null }) {
  return <div className="hs-player">
    <PlayerAvatar name={player.name} photoUrl={player.photo} small/>
    <div className="hs-player-body">
      <b>{player.name}</b>
      <StatsGrid player={player} stats={stats}/>
    </div>
    {href && <Link className="hs-profile" href={href} aria-label={`Ficha SNP de ${player.name}`}><IdCard size={16}/><span>Ficha</span></Link>}
  </div>;
}

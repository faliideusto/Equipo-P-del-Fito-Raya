"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IdCard, Plus, Search, X } from "lucide-react";
import type { Pair } from "@/domain/types";
import { matchValue } from "@/domain/rules";
import { completePairPoints, orderedPairs } from "@/domain/head-to-head";
import { PlayerAvatar } from "@/components/player-avatar";
import { formatPoints, formatWinRate } from "@/lib/format";
import type { LineupPlayer } from "./types";
import type { PlayerStats } from "./use-player-stats";

type Slot = { pairId: string; slot: 0 | 1 };
// Five pairs ordered by SNP points. Tapping a slot opens the player list; a player who already has a
// pair swaps places with the one in the slot.
export function PairEditor({ players, pairs, onChange, side, profile, stats }: { players: LineupPlayer[]; pairs: Pair[]; onChange: (pairs: Pair[]) => void; side: "own" | "rival"; profile: (player: LineupPlayer) => string | null; stats: Record<string, PlayerStats> }) {
  const [picking, setPicking] = useState<Slot | null>(null);
  const person = (id: string | null) => players.find(player => player.id === id);
  const points = (id: string) => person(id)?.points;
  const ordered = orderedPairs(pairs, points);
  const pairNumber = (id: string) => ordered.findIndex(pair => pair.players.includes(id)) + 1;
  function place({ pairId, slot }: Slot, id: string | null) {
    const next = pairs.map(pair => ({ ...pair, players: [...pair.players] as Pair["players"] }));
    const target = next.find(pair => pair.id === pairId)!;
    const source = id ? next.find(pair => pair.players.includes(id)) : undefined;
    if (source) source.players[source.players.indexOf(id)] = target.players[slot];
    target.players[slot] = id;
    onChange(next);
  }
  return <>
    <div className={`hs-editor is-${side}`}>
      {ordered.map((pair, index) => {
        const total = completePairPoints(pair, points);
        return <article key={pair.id} className={`hs-edit-pair ${total !== null ? "is-complete" : ""}`}>
          <header><span className="hs-pair-number">P{index + 1}</span><span className="hs-pair-value">{matchValue(index)} pts en juego</span><strong>{total !== null ? `${formatPoints(total)} pts` : "Incompleta"}</strong></header>
          <div className="hs-edit-slots">{([0, 1] as const).map(slot => {
            const player = person(pair.players[slot]);
            return player
              ? <div key={slot} className="hs-slot is-filled">
                <button type="button" className="hs-slot-main" onClick={() => setPicking({ pairId: pair.id, slot })} aria-label={`Cambiar a ${player.name}`}><PlayerAvatar name={player.name} photoUrl={player.photo} small/><span><b>{player.name}</b><small>{formatPoints(player.points)} pts SNP</small><SlotStats player={player} stats={stats[player.id]}/></span></button>
                {profile(player) && <Link className="hs-slot-profile" href={profile(player)!} aria-label={`Ficha SNP de ${player.name}`}><IdCard size={16}/><span>Ficha</span></Link>}
                <button type="button" className="hs-slot-remove" aria-label={`Quitar a ${player.name}`} onClick={() => place({ pairId: pair.id, slot }, null)}><X size={16}/></button>
              </div>
              : <button key={slot} type="button" className="hs-slot is-empty" onClick={() => setPicking({ pairId: pair.id, slot })}><Plus size={16}/> Añadir jugador</button>;
          })}</div>
        </article>;
      })}
    </div>
    {picking && <SlotPicker players={players} current={pairs.find(pair => pair.id === picking.pairId)!.players[picking.slot]} pairNumber={pairNumber} onClose={() => setPicking(null)} onChoose={id => { place(picking, id); setPicking(null); }}/>}
  </>;
}

function SlotPicker({ players, current, pairNumber, onChoose, onClose }: { players: LineupPlayer[]; current: string | null; pairNumber: (id: string) => number; onChoose: (id: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es");
  // Free players first, then the ones already in a pair; each group by SNP points.
  const visible = players.filter(player => player.id !== current && normalize(player.name).includes(normalize(search)))
    .sort((a, b) => Number(pairNumber(a.id) > 0) - Number(pairNumber(b.id) > 0) || (b.points ?? 0) - (a.points ?? 0));
  return <dialog ref={ref} className="player-picker hs-picker" aria-labelledby="hs-picker-title" onCancel={onClose} onClick={event => { if (event.target === ref.current) onClose(); }}>
    <div className="panel-heading"><h2 id="hs-picker-title">Elige un jugador</h2><button type="button" aria-label="Cerrar" onClick={onClose}><X size={20}/></button></div>
    <label className="hs-picker-search"><Search size={16}/><input autoFocus type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre" aria-label="Buscar jugador"/></label>
    <div className="picker-list">{visible.map(player => { const pair = pairNumber(player.id); return <button key={player.id} type="button" onClick={() => onChoose(player.id)}>
      <PlayerAvatar name={player.name} photoUrl={player.photo} small/><span>{player.name}<small>{pair ? `En la pareja ${pair} · se intercambian` : "Sin pareja"}</small></span><b>{formatPoints(player.points)}</b>
    </button>; })}{!visible.length && <p className="panel-empty">No hay jugadores que coincidan.</p>}</div>
  </dialog>;
}

// Total winrate and won-lost matches of the player's whole SNP history.
function SlotStats({ player, stats }: { player: LineupPlayer; stats?: PlayerStats }) {
  if (!player.snpId) return null;
  if (!stats) return <small className="hs-slot-stats is-loading">Cargando estadísticas…</small>;
  if (!stats.rate) return <small className="hs-slot-stats">Estadísticas no disponibles</small>;
  return <small className="hs-slot-stats"><em>WR {formatWinRate(stats.rate.percentage)}</em> · {stats.rate.won}G-{stats.rate.lost}P</small>;
}

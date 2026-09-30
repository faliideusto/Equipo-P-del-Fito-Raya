"use client";
import { useState } from "react";
import { RotateCcw, Plus, X } from "lucide-react";
import type { SnpPlayer } from "@/domain/snp";
import type { Pair } from "@/domain/types";
import { emptyLineup, matchValue } from "@/domain/rules";
import { PlayerAvatar } from "@/components/player-avatar";
import { formatPoints } from "@/lib/format";

export function MiniLineup({ players }: { players: SnpPlayer[] }) {
  const [draft, setDraft] = useState<Pair[]>(emptyLineup);
  const [armed, setArmed] = useState<string | null>(null);
  const [message, setMessage] = useState("Pulsa dos jugadores para formar una pareja o utiliza los huecos.");
  const pairs = draft.map(pair => ({ ...pair, players: pair.players.map(id => players.some(p => p.id === id) ? id : null) as Pair["players"] }));
  const person = (id: string | null) => players.find(p => p.id === id);
  const points = (pair: Pair) => pair.players.reduce((sum, id) => sum + (person(id)?.points ?? 0), 0);
  const ordered = [...pairs].sort((a, b) => points(b) - points(a) || a.id.localeCompare(b.id));
  const used = pairs.flatMap(pair => pair.players);
  const free = [...players].filter(p => !used.includes(p.id)).sort((a, b) => b.points - a.points);
  function choose(id: string) {
    if (armed === id) { setArmed(null); return; }
    if (!armed || !free.some(p => p.id === armed)) { setArmed(id); setMessage("Selecciona otro jugador o pulsa un hueco de pareja."); return; }
    const target = pairs.find(pair => pair.players.every(p => p === null));
    if (!target) { setMessage("No queda una pareja vacía. Usa los huecos libres o deshaz una pareja."); return; }
    setDraft(pairs.map(pair => pair.id === target.id ? { ...pair, players: [armed, id] } : pair));
    setArmed(null); setMessage("Pareja creada. Orden actualizado por puntos SNP.");
  }
  function place(pairId: string, slot: 0 | 1, id: string | null) {
    const next = pairs.map(pair => ({ ...pair, players: [...pair.players] as Pair["players"] }));
    const target = next.find(pair => pair.id === pairId)!;
    const source = id ? next.find(pair => pair.players.includes(id)) : undefined;
    if (source) source.players[source.players.indexOf(id)] = target.players[slot];
    target.players[slot] = id;
    setDraft(next); setArmed(null); setMessage("Alineación de prueba actualizada.");
  }
  return <section className="panel mini-lineup"><div className="panel-heading"><div><h2>Prueba su alineación</h2><p>Crea hasta cinco parejas y compara sus puntos SNP.</p></div><button className="button secondary small" onClick={() => { setDraft(emptyLineup()); setArmed(null); setMessage("Alineación vaciada."); }}><RotateCcw size={14}/> Vaciar</button></div>
    <p className="data-note" role="status">{message}</p><div className="mini-player-pool">{free.map(p => <button key={p.id} className={`pool-player ${armed === p.id ? "armed" : ""}`} aria-pressed={armed === p.id} onClick={() => choose(p.id)}><PlayerAvatar name={p.name} photoUrl={p.photoUrl} small/><span>{p.name}<small>{formatPoints(p.points)} pts SNP</small></span><Plus size={15}/></button>)}</div>
    <div className="mini-pairs">{ordered.map((pair, index) => <article key={pair.id} className="mini-pair"><div className="mini-pair-heading"><strong>Pareja {index + 1}</strong><span>{formatPoints(points(pair))} pts SNP · {matchValue(index)} pts en juego</span><button aria-label={`Deshacer pareja ${index + 1}`} onClick={() => { setDraft(pairs.map(p => p.id === pair.id ? { ...p, players: [null, null] } : p)); setArmed(null); }}><X size={16}/></button></div><div className="mini-pair-slots">{([0, 1] as const).map(slot => <div key={slot}>{armed ? <button className="button secondary small" onClick={() => place(pair.id, slot, armed)}>{person(pair.players[slot])?.name ?? "Hueco libre"} · Colocar seleccionado</button> : <select aria-label={`Jugador ${slot + 1} de pareja ${index + 1}`} value={pair.players[slot] ?? ""} onChange={e => place(pair.id, slot, e.target.value || null)}><option value="">Seleccionar jugador</option>{[...players].sort((a, b) => b.points - a.points).map(p => <option key={p.id} value={p.id}>{p.name} · {formatPoints(p.points)} pts</option>)}</select>}</div>)}</div></article>)}</div>
    <p className="data-note">{pairs.filter(pair => pair.players.every(Boolean)).length}/5 parejas completas · {formatPoints(pairs.reduce((sum, pair) => sum + points(pair), 0))} pts SNP. Esta prueba es temporal y se reinicia al salir; no cambia los datos del equipo.</p>
  </section>;
}

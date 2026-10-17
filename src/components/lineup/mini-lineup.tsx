"use client";
import { useState } from "react";
import { RotateCcw, Plus, X } from "lucide-react";
import type { SnpPlayer } from "@/domain/snp";
import type { Pair } from "@/domain/types";
import { emptyLineup, matchValue } from "@/domain/rules";
import { PlayerAvatar } from "@/components/player-avatar";
import { cardPhoto } from "@/data/player-photos";
import { formatDate, formatPoints } from "@/lib/format";
import type { RivalPreparation } from "@/lib/rival-preparation";

export function MiniLineup({ players, preparation }: { players: SnpPlayer[]; preparation: RivalPreparation }) {
  const [draft, setDraft] = useState<Pair[]>(emptyLineup);
  const [armed, setArmed] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Pulsa dos jugadores para formar una pareja o utiliza los huecos.");
  const pairs = draft.map(pair => ({ ...pair, players: pair.players.map(id => players.some(p => p.id === id) ? id : null) as Pair["players"] }));
  const person = (id: string | null) => players.find(p => p.id === id);
  const points = (pair: Pair) => pair.players.reduce((sum, id) => sum + (person(id)?.points ?? 0), 0);
  const ordered = [...pairs].sort((a, b) => points(b) - points(a) || a.id.localeCompare(b.id));
  const used = pairs.flatMap(pair => pair.players);
  const free = [...players].filter(p => !used.includes(p.id)).sort((a, b) => b.points - a.points);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const visible = free.filter(p => normalize(p.name).includes(normalize(search)));
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
  return <section className="panel mini-lineup" aria-label="Preparación de la alineación rival">
    <div className="rival-preparation-context"><span className="badge blue">Privado · Entrenador y capitanes</span><span>Próximo rival del equipo {preparation.teamId.toUpperCase()} · Jornada {preparation.round}{preparation.date ? ` · ${formatDate(preparation.date)}` : ""}</span></div>
    <div className="panel-heading"><div><h2>Posibles parejas del rival</h2><p>Elige a los jugadores que crees que traerán y forma sus cinco parejas. El orden se ajusta por puntos SNP.</p></div><button type="button" className="button secondary small" onClick={() => { setDraft(emptyLineup()); setArmed(null); setMessage("Alineación vaciada."); }}><RotateCcw size={14}/> Vaciar</button></div>
    <label className="rival-player-search">Buscar jugador<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre del jugador"/></label>
    <p className="data-note" role="status">{message}</p><div className="mini-player-pool">{visible.map(p => <button key={p.id} className={`pool-player ${armed === p.id ? "armed" : ""}`} aria-pressed={armed === p.id} onClick={() => choose(p.id)}><PlayerAvatar name={p.name} photoUrl={cardPhoto(p)} small/><span>{p.name}<small>{formatPoints(p.points)} pts SNP</small></span><Plus size={15}/></button>)}{!visible.length && <p className="panel-empty">{free.length ? "No hay jugadores que coincidan con la búsqueda." : "Todos los jugadores tienen pareja."}</p>}</div>
    <div className="mini-pairs">{ordered.map((pair, index) => <article key={pair.id} className="mini-pair"><div className="mini-pair-heading"><strong>Pareja {index + 1}</strong><span>{formatPoints(points(pair))} pts SNP · {matchValue(index)} pts en juego</span><button aria-label={`Deshacer pareja ${index + 1}`} onClick={() => { setDraft(pairs.map(p => p.id === pair.id ? { ...p, players: [null, null] } : p)); setArmed(null); }}><X size={16}/></button></div><div className="mini-pair-slots">{([0, 1] as const).map(slot => <div key={slot}>{armed ? <button className="button secondary small" onClick={() => place(pair.id, slot, armed)}>{person(pair.players[slot])?.name ?? "Hueco libre"} · Colocar seleccionado</button> : <select aria-label={`Jugador ${slot + 1} de pareja ${index + 1}`} value={pair.players[slot] ?? ""} onChange={e => place(pair.id, slot, e.target.value || null)}><option value="">Seleccionar jugador</option>{[...players].sort((a, b) => b.points - a.points).map(p => <option key={p.id} value={p.id}>{p.name} · {formatPoints(p.points)} pts</option>)}</select>}</div>)}</div></article>)}</div>
    <p className="data-note">{pairs.filter(pair => pair.players.every(Boolean)).length}/5 parejas completas · {formatPoints(pairs.reduce((sum, pair) => sum + points(pair), 0))} pts SNP. Es una simulación temporal; no es la convocatoria confirmada del rival y se reinicia al salir.</p>
  </section>;
}

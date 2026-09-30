"use client";
import { useState } from "react";
import {
  Check,
  ChevronDown,
  GripVertical,
  Plus,
  RotateCcw,
  ArrowRightLeft,
  Info,
} from "lucide-react";
import type { Pair, Player, TeamId } from "@/domain/types";
import {
  assignPlayer,
  createPair,
  emptyLineup,
  pairPoints,
  positionLabel,
  removePlayer,
  sortPairs,
} from "@/domain/rules";
import { formatPoints } from "@/lib/format";
import { PlayerAvatar } from "@/components/player-avatar";
import { PlayerPicker } from "./player-picker";
import { PairCard } from "./pair-card";
import { PositionEditor } from "./position-editor";
export function LineupBuilder({
  players: initialPlayers,
  teamId,
}: {
  players: Player[];
  teamId: TeamId;
}) {
  const [players, setPlayers] = useState(initialPlayers);
  const [selected, setSelected] = useState<string[]>(players.map((p) => p.id));
  const [pairs, setPairs] = useState<Pair[]>(emptyLineup);
  const [armed, setArmed] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ pairId: string; slot: 0 | 1 } | null>(
    null,
  );
  const [notice, setNotice] = useState(
    "Pulsa dos jugadores para crear una pareja abajo. También puedes usar los huecos o arrastrarlos.",
  );
  const [selectionOpen, setSelectionOpen] = useState(true);
  const ordered = sortPairs(pairs, players);
  const used = pairs.flatMap((p) => p.players).filter(Boolean);
  const pool = players.filter(
    (p) => selected.includes(p.id) && !used.includes(p.id),
  );
  const totals = pairs.map((p) => pairPoints(p, players));
  const total = totals.some((value) => value === null)
    ? null
    : totals.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const complete = pairs.filter((p) => p.players.every(Boolean)).length;
  const playerById = (id: string | null) => players.find((p) => p.id === id);
  const armedPosition = playerById(armed)?.position;
  function suggestion(player: Player) {
    if (player.id === armed || !armedPosition) return "";
    if (player.position === "BOTH") return "suggest-both";
    if ((armedPosition === "LEFT" && player.position === "RIGHT") || (armedPosition === "RIGHT" && player.position === "LEFT")) return "suggest-opposite";
    return "";
  }
  function toggle(id: string) {
    const checked = selected.includes(id);
    setSelected(
      checked ? selected.filter((value) => value !== id) : [...selected, id],
    );
    if (checked) {
      setPairs((current) => removePlayer(current, id));
      if (armed === id) setArmed(null);
      if (used.includes(id))
        setNotice(`${playerById(id)?.name} se ha retirado de su pareja.`);
    }
  }
  function place(id: string, pairId: string, slot: 0 | 1) {
    setPairs((current) =>
      assignPlayer(current, id, pairId, slot, players, selected, teamId),
    );
    setArmed(null);
    setPicker(null);
    setNotice("Alineación actualizada. Puntos y orden SNP recalculados.");
  }
  function slotClick(pairId: string, slot: 0 | 1) {
    if (armed) place(armed, pairId, slot);
    else setPicker({ pairId, slot });
  }
  function choosePlayer(id: string) {
    if (picker) place(id, picker.pairId, picker.slot);
    else {
      setArmed(id === armed ? null : id);
      setNotice(
        "Toca un hueco para colocar al jugador o una tarjeta para intercambiarlo.",
      );
    }
  }
  function choosePoolPlayer(id: string) {
    if (armed === id) {
      setArmed(null);
      setNotice("Selección cancelada. Pulsa dos jugadores para crear una pareja.");
      return;
    }
    if (armed && pool.some((player) => player.id === armed)) {
      const next = createPair(pairs, armed, id, players, selected, teamId);
      if (next === pairs) {
        setNotice("No hay una pareja vacía. Completa un hueco libre o deshaz una pareja para crear otra.");
        return;
      }
      setPairs(next);
      setArmed(null);
      setNotice(`Pareja creada: ${playerById(armed)?.name} y ${playerById(id)?.name}. Ya está en Tu alineación, ordenada por puntos SNP.`);
      return;
    }
    setArmed(id);
    setNotice(`${playerById(id)?.name} seleccionado. Pulsa otro jugador sin pareja o un hueco para colocarlo.`);
  }
  return (
    <div className="laboratory">
      <aside className="selection-panel">
        <button
          className="selection-heading"
          onClick={() => setSelectionOpen(!selectionOpen)}
          aria-expanded={selectionOpen}
        >
          <span>
            <strong>Convocatoria de prueba</strong>
            <small>La selección es temporal</small>
          </span>
          <ChevronDown size={17} />
        </button>
        <div className={`selection-body ${selectionOpen ? "expanded" : ""}`}>
          <div className="selection-count">
            <strong>
              {selected.length}
              <span> / 10</span>
              {selected.length === 10 && <Check size={16} />}
            </strong>
            <span>jugadores seleccionados</span>
          </div>
          <div className="selection-actions">
            <button
              onClick={() => {
                setSelected(players.map((p) => p.id));
                setNotice("Toda la plantilla seleccionada.");
              }}
            >
              Todos
            </button>
            <button
              onClick={() => {
                setSelected([]);
                setPairs(emptyLineup());
                setArmed(null);
                setNotice("Selección y alineación vaciadas.");
              }}
            >
              Ninguno
            </button>
          </div>
          <div className="selection-list">
            {players.map((p) => (
              <label
                key={p.id}
                className={selected.includes(p.id) ? "checked" : ""}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <span>
                  {p.name}
                  <small title={positionLabel(p.position)}>
                    {positionLabel(p.position)}
                  </small>
                </span>
                <b>{formatPoints(p.points)}</b>
              </label>
            ))}
          </div>
        </div>
        <div className="selection-help">
          <Info size={15} />
          <p>
            Prueba con cualquier número de jugadores. Una alineación completa
            utiliza 10.
          </p>
        </div>
      </aside>
      <div className="lineup-workspace">
        <div className="lab-toolbar">
          <div>
            <span className="badge blue">LABORATORIO</span>
            <span>{complete} / 5 parejas completas</span>
          </div>
          <button
            className="button secondary small"
            onClick={() => {
              setPairs(emptyLineup());
              setArmed(null);
              setPicker(null);
              setNotice("Alineación vaciada. Puedes empezar de nuevo.");
            }}
          >
            <RotateCcw size={14} /> Vaciar alineación
          </button>
        </div>
        <div className="lab-notice" role="status">
          <ArrowRightLeft size={15} />
          {notice}
        </div>
        <section className="pool">
          <div className="pool-heading">
            <h2>
              Jugadores sin pareja <span>{pool.length}</span>
            </h2>
            <small>Pulsa dos jugadores, usa un hueco o arrastra</small>
          </div>
          {armedPosition && <p className="position-legend"><span>Verde: lado complementario</span><span>Amarillo: juega en ambos lados</span></p>}
          <div className="player-pool">
            {pool.map((p) => (
              <button
                key={p.id}
                draggable
                onDragStart={(event) =>
                  event.dataTransfer.setData("text/plain", p.id)
                }
                onClick={() => choosePoolPlayer(p.id)}
                className={`pool-player ${armed === p.id ? "armed" : ""} ${suggestion(p)}`}
                title={`${p.name} · ${positionLabel(p.position)} · ${formatPoints(p.points)} SNP`}
                aria-pressed={armed === p.id}
              >
                <GripVertical size={13} />
                <PlayerAvatar name={p.name} photoUrl={p.photoUrl} small />
                <span>
                  {p.name}
                  <small>{formatPoints(p.points)} pts SNP · {positionLabel(p.position)}</small>
                </span>
                <Plus size={15} />
              </button>
            ))}
            {pool.length === 0 && (
              <p className="pool-empty">
                {selected.length === 0
                  ? "Selecciona jugadores de la plantilla para empezar."
                  : "Todos los jugadores seleccionados tienen pareja."}
              </p>
            )}
          </div>
        </section>
        <div className="pair-section-title">
          <h2>Tu alineación</h2>
          <span>
            <Check size={14} /> Orden SNP automático
          </span>
        </div>
        <div className="pairs-list">
          {ordered.map((pair, index) => (
            <PairCard
              key={pair.id}
              pair={pair}
              index={index}
              players={players}
              armed={armed}
              onPlace={place}
              onSlotClick={slotClick}
              onChoose={choosePlayer}
              onRemove={(player) => {
                setPairs((current) => removePlayer(current, player.id));
                if (armed === player.id) setArmed(null);
                setNotice(`${player.name} vuelve a jugadores sin pareja.`);
              }}
              onClear={(pairId) => {
                setPairs((current) =>
                  current.map((p) =>
                    p.id === pairId ? { ...p, players: [null, null] } : p,
                  ),
                );
                setNotice(
                  "Pareja deshecha. Jugadores devueltos a la zona de creación.",
                );
              }}
            />
          ))}
        </div>
        <div className={`lineup-summary ${complete === 5 ? "ready" : ""}`}>
          <span>
            {complete === 5
              ? "✓ Alineación completa"
              : "Tu alineación está en construcción"}
          </span>
          <strong>
            {formatPoints(total)} <small>pts SNP totales</small>
          </strong>
        </div>
        <p className="data-note">
          Las parejas se ordenan por suma de puntos. Los empates mantienen el
          orden de los huecos originales. Los campos de puntos vacíos en SNP se
          han importado como 0. Puedes definir las posiciones en el apartado inferior. Los
          conflictos de posición son avisos y permiten seguir probando.
        </p>
        <PositionEditor players={players} teamId={teamId} onSaved={setPlayers} />
      </div>
      {picker && (
        <PlayerPicker
          players={players.filter((p) => selected.includes(p.id))}
          used={used}
          onClose={() => setPicker(null)}
          onChoose={(id) => place(id, picker.pairId, picker.slot)}
        />
      )}
    </div>
  );
}

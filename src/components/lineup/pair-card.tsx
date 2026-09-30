"use client";
import { ArrowRightLeft, Plus, Trash2, X } from "lucide-react";
import type { Pair, Player } from "@/domain/types";
import {
  compatible,
  matchValue,
  pairPoints,
  positionLabel,
} from "@/domain/rules";
import { formatPoints } from "@/lib/format";
import { PlayerAvatar } from "@/components/player-avatar";
interface PairCardProps {
  pair: Pair;
  index: number;
  players: Player[];
  armed: string | null;
  onPlace: (playerId: string, pairId: string, slot: 0 | 1) => void;
  onSlotClick: (pairId: string, slot: 0 | 1) => void;
  onChoose: (id: string) => void;
  onRemove: (player: Player) => void;
  onClear: (pairId: string) => void;
}
export function PairCard({
  pair,
  index,
  players,
  armed,
  onPlace,
  onSlotClick,
  onChoose,
  onRemove,
  onClear,
}: PairCardProps) {
  const first = players.find((p) => p.id === pair.players[0]);
  const second = players.find((p) => p.id === pair.players[1]);
  const valid =
    first && second ? compatible(first.position, second.position) : null;
  return (
    <article className={`pair-card ${first && second ? "filled" : ""}`}>
      <div className="pair-rank">
        <span>PAREJA</span>
        <strong>{String(index + 1).padStart(2, "0")}</strong>
        <small>{matchValue(index)} pts en juego</small>
      </div>
      <div className="pair-content">
        <div className="pair-slots">
          {([0, 1] as const).map((slot) => {
            const player = players.find((p) => p.id === pair.players[slot]);
            return (
              <div
                key={slot}
                className={`player-slot ${player ? "occupied" : ""} ${armed ? "drop-ready" : ""}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  onPlace(
                    event.dataTransfer.getData("text/plain"),
                    pair.id,
                    slot,
                  );
                }}
              >
                <button
                  className="slot-button"
                  aria-label={`${player ? "Cambiar " + player.name : "Añadir jugador"} en pareja ${index + 1}, hueco ${slot + 1}`}
                  onClick={() => onSlotClick(pair.id, slot)}
                  draggable={!!player}
                  onDragStart={(event) =>
                    player &&
                    event.dataTransfer.setData("text/plain", player.id)
                  }
                >
                  {player ? (
                    <>
                      <PlayerAvatar name={player.name} photoUrl={player.photoUrl} small />
                      <span>
                        {player.name}
                        <small title={positionLabel(player.position)}>
                          {formatPoints(player.points)} pts SNP ·{" "}
                          {positionLabel(player.position)}
                        </small>
                      </span>
                    </>
                  ) : (
                    <>
                      <Plus size={17} />
                      <span>Añadir jugador</span>
                    </>
                  )}
                </button>
                {player && (
                  <>
                    <button
                      className="slot-swap"
                      aria-label={`Seleccionar ${player.name} para intercambiar`}
                      onClick={() => onChoose(player.id)}
                      aria-pressed={armed === player.id}
                    >
                      <ArrowRightLeft size={14} />
                    </button>
                    <button
                      className="slot-remove"
                      aria-label={`Quitar ${player.name}`}
                      onClick={() => onRemove(player)}
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="pair-status">
          {valid === null ? (
            <span>
              {first && second
                ? "Posiciones por confirmar"
                : "Pareja por completar"}
            </span>
          ) : (
            <span className={valid ? "compatible" : "conflict"}>
              {valid ? "✓ Compatible" : "⚠ Posiciones incompatibles"}
            </span>
          )}
          {(first || second) && (
            <button onClick={() => onClear(pair.id)}>
              <Trash2 size={12} /> Deshacer pareja
            </button>
          )}
        </div>
      </div>
      <div className="pair-points">
        <strong>{formatPoints(pairPoints(pair, players))}</strong>
        <span>PTS SNP</span>
      </div>
    </article>
  );
}

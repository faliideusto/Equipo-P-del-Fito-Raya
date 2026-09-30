"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Player } from "@/domain/types";
import { positionLabel } from "@/domain/rules";
import { formatPoints } from "@/lib/format";
import { PlayerAvatar } from "@/components/player-avatar";
export function PlayerPicker({
  players,
  used,
  partner,
  onChoose,
  onClose,
}: {
  players: Player[];
  used: (string | null)[];
  partner?: Player;
  onChoose: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="player-picker"
      aria-labelledby="picker-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="panel-heading">
        <h2 id="picker-title">Elige un jugador</h2>
        <button autoFocus aria-label="Cerrar selector" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <p>Si ya tiene pareja, intercambia su hueco con el jugador actual.</p>
      {partner && <p className="position-legend"><span>Verde: lado complementario</span><span>Amarillo: juega en ambos lados</span></p>}
      <div className="picker-list">
        {players.map((p) => (
          <button key={p.id} onClick={() => onChoose(p.id)} className={p.id === partner?.id || !partner ? "" : p.position === "BOTH" ? "suggest-both" : (partner.position === "LEFT" && p.position === "RIGHT") || (partner.position === "RIGHT" && p.position === "LEFT") ? "suggest-opposite" : ""}>
            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} small />
            <span>
              {p.name}
              <small>
                {positionLabel(p.position)}
                {used.includes(p.id) ? " · En pareja" : " · Sin pareja"}
              </small>
            </span>
            <b>{formatPoints(p.points)}</b>
          </button>
        ))}
      </div>
      {players.length === 0 && <p>Selecciona jugadores en la convocatoria.</p>}
    </dialog>
  );
}

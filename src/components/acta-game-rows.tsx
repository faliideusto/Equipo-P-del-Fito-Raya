"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Hourglass } from "lucide-react";
import type { SnpMatch } from "@/domain/snp";
import { matchValue } from "@/domain/rules";
import { cellsToSets, checkSets, setsToCells, visibleCells, type SetScore } from "@/domain/match-result";
import { toActaSets } from "@/domain/result-edit";
import { updateCell } from "./result-sets-grid";
export type ActaProvisional = { fixtureId: string; teamId: string; ownSide: 0 | 1; sets: SetScore[] | null; editable: boolean };
type Game = SnpMatch["games"][number];
// One match of the acta: SNP sets when published; otherwise the provisional
// result saved in the app, editable in place by the players of that pair.
export function ActaGameRows({ game, teams, teamIds, provisional }: { game: Game; teams: [string, string]; teamIds?: [string, string]; provisional?: ActaProvisional }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string[][] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = !game.sets.length && provisional ? provisional : null;
  const shown: SetScore[] = game.sets.length ? game.sets : pending?.sets ? toActaSets(pending.sets, pending.ownSide) : [];
  const victories = shown.reduce((n, s) => n + (s[0] > s[1] ? 1 : 0), 0); const defeats = shown.reduce((n, s) => n + (s[1] > s[0] ? 1 : 0), 0);
  const winner = victories >= 2 ? 0 : defeats >= 2 ? 1 : null; const value = game.index < 5 ? matchValue(game.index) : null;
  const view = editing && visibleCells(editing);
  async function save() {
    if (!pending || !view) return;
    const sets = cellsToSets(view.cells); const check = checkSets(sets);
    if (!check.ok) { setMessage(check.error); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit", fixtureId: pending.fixtureId, teamId: pending.teamId, pairIndex: game.index + 1, sets }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error || "No se pudo modificar. Inténtalo de nuevo."); return; }
      setEditing(null); router.refresh();
    } catch { setMessage("No se pudo modificar. Comprueba la conexión."); } finally { setBusy(false); }
  }
  return <tbody className={`result-group ${pending?.sets ? "is-provisional" : ""}`}>{[0, 1].map(side => {
    const names = side === 0 ? game.homePlayers : game.awayPlayers; const people = side === 0 ? game.home : game.away; const own = teams[side].includes("FITO RAYA");
    // Inputs are stored [nosotros, rivales]: map this acta row to our side or theirs.
    const inputSide = pending ? (side === pending.ownSide ? 0 : 1) : 0;
    return <tr key={side} className={own ? "club-result" : "rival-result"}>
      {side === 0 && <th className="result-number" scope="rowgroup" rowSpan={pending?.sets ? 3 : 2}><span>{String(game.index + 1).padStart(2, "0")}</span><small>{value ?? "—"} pts en juego</small>{pending?.sets && <small className="provisional-tag"><Hourglass size={12} aria-hidden/><span>Provisional</span></small>}</th>}
      <th className="result-team" scope="row"><small>{teams[side]} · {side === 0 ? "Local" : "Visitante"}</small>{names.length ? names.map((name, i) => { const person = people?.[i]; return <span key={person?.id || i}>{person?.id ? <Link href={`/competicion/jugadores/${person.id}${teamIds?.[side] ? `?equipo=${teamIds[side]}` : ""}`}>{name}</Link> : name}</span>; }) : <span>Sin alineación publicada</span>}</th>
      {[0, 1, 2].map(i => <td className="result-set" key={i}>{view
        ? <input className="acta-set-input" inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label={`${side === pending!.ownSide ? "Nosotros" : "Rivales"}, set ${i + 1}`} disabled={i === 2 && view.thirdLocked} value={view.cells[i][inputSide]} onChange={e => setEditing(updateCell(editing!, i, inputSide, e.target.value.replace(/\D/g, "")))}/>
        : <span className={shown[i] && shown[i][side] > shown[i][1 - side] ? "set-won" : ""}>{shown[i]?.[side] ?? "—"}</span>}</td>)}
      <td className="result-points"><span className={winner === side ? "points-earned" : ""}>{winner === null || value === null ? "—" : winner === side ? value : 0}</span></td>
    </tr>;
  })}
    {pending?.sets && <tr className="provisional-row"><td colSpan={5}>
      <div className="provisional-actions">
        <span className="provisional-note"><Hourglass size={14} aria-hidden/> Resultado provisional de la app, hasta que SNP lo publique.</span>
        {pending.editable && (view
          ? <span className="provisional-buttons"><button type="button" className="button" disabled={busy} onClick={() => void save()}>Guardar</button><button type="button" className="button secondary" disabled={busy} onClick={() => { setEditing(null); setMessage(""); }}>Cancelar</button></span>
          : <button type="button" className="button secondary" onClick={() => setEditing(setsToCells(pending.sets!))}>Modificar</button>)}
      </div>
      {message && <p role="alert" className="snp-warning">{message}</p>}
    </td></tr>}
  </tbody>;
}

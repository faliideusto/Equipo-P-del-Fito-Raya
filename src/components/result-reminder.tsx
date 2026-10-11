"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Lock, X } from "lucide-react";
import { cellsToSets, checkSets, type SetScore } from "@/domain/match-result";
import { dueForCheck, type PendingResult } from "@/domain/pending-results";
import { formatDate } from "@/lib/format";
const SEEN_KEY = "fito-result-seen";
type Form = { fixtureId: string; pair: number | null; cells: string[][]; message: string; existing: SetScore[] | null };
const blank = (fixtureId = ""): Form => ({ fixtureId, pair: null, cells: [["", ""], ["", ""], ["", ""]], message: "", existing: null });
function seen(): string[] { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch { return []; } }
function markSeen(id: string) { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen().filter(x => x !== id), id].slice(-20))); } catch { /* Private mode: the dialog may open again. */ } }
export function ResultReminder() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<PendingResult[]>([]);
  const [stored, setForm] = useState<Form>(blank);
  const [busy, setBusy] = useState(false);
  const current = pending[0];
  // Form state belongs to one fixture; a new pending fixture starts empty.
  const form = current && stored.fixtureId === current.fixtureId ? stored : blank(current?.fixtureId);
  const update = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const open = useCallback(() => { if (!current) return; markSeen(current.fixtureId); if (!dialog.current?.open) dialog.current?.showModal(); }, [current]);
  const lastCheck = useRef<number | null>(null);
  const refresh = useCallback((signal?: AbortSignal) => fetch("/api/results/pending", { signal, cache: "no-store" }).then(r => r.ok ? r.json() : { pending: [] }).then(data => { lastCheck.current = Date.now(); const list: PendingResult[] = Array.isArray(data.pending) ? data.pending : []; setPending(list); return list; }), []);
  useEffect(() => {
    if (!dueForCheck(lastCheck.current, Date.now())) return;
    const controller = new AbortController();
    void refresh(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [pathname, refresh]);
  useEffect(() => { if (current && !seen().includes(current.fixtureId)) open(); }, [current, open]);
  // A third set is not allowed once the first two have a winner.
  const firstTwoDecided = checkSets(cellsToSets([form.cells[0], form.cells[1], ["", ""]])).ok;
  const cells = firstTwoDecided ? [form.cells[0], form.cells[1], ["", ""]] : form.cells;
  const pair = current?.pairLocked ?? form.pair;
  async function send(action: "result" | "absent" | "confirm") {
    if (!current) return;
    const sets = cellsToSets(cells);
    if (action === "result") { const check = checkSets(sets); if (!check.ok) { update({ message: check.error }); return; } if (!pair) { update({ message: "Elige tu número de pareja." }); return; } }
    setBusy(true); update({ message: "" });
    try {
      const response = await fetch("/api/results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, fixtureId: current.fixtureId, teamId: current.teamId, pairIndex: pair, sets }) });
      const data = await response.json();
      if (response.status === 409 && data.existing) { update({ existing: data.existing, message: data.error }); return; }
      // Another player resolved it first: refresh instead of leaving a stale dialog open.
      if (response.status === 409) { const list = await refresh(); if (!list.some(p => p.fixtureId === current.fixtureId && p.teamId === current.teamId)) dialog.current?.close(); else update({ message: data.error }); return; }
      if (!response.ok) { update({ message: data.error || "No se pudo guardar. Inténtalo de nuevo." }); return; }
      dialog.current?.close(); setPending(Array.isArray(data.pending) ? data.pending : []);
    } catch { update({ message: "No se pudo guardar. Comprueba la conexión." }); } finally { setBusy(false); }
  }
  if (!current) return null;
  const title = `Jornada ${current.round} · ${current.teamId === "a" ? "Fito A" : "Fito B"} vs ${current.opponent}`;
  const setCell = (set: number, side: number, value: string) => update({ cells: form.cells.map((row, i) => i === set ? row.map((v, j) => j === side ? value.replace(/\D/g, "") : v) : row) });
  return <>
    <button type="button" className="result-chip" onClick={open} aria-haspopup="dialog"><AlertTriangle size={16} aria-hidden/>Resultado pendiente · J{current.round}{pending.length > 1 && <b>{pending.length}</b>}</button>
    <dialog ref={dialog} className="result-dialog" aria-labelledby="result-title">
      <form className="result-dialog-body" onSubmit={e => { e.preventDefault(); void send("result"); }}>
        <header><div><span className="result-eyebrow">¿Cómo fue tu partido?</span><h2 id="result-title">{title}</h2><p>{formatDate(current.date)}</p></div><button type="button" className="result-close" aria-label="Cerrar" onClick={() => dialog.current?.close()}><X size={18}/></button></header>
        <fieldset className="result-pairs" disabled={Boolean(current.pairLocked)}><legend>Pareja {current.pairLocked && <span className="result-locked"><Lock size={12} aria-hidden/> según acta SNP</span>}</legend>
          {[1, 2, 3, 4, 5].map(n => <label key={n} className={pair === n ? "is-active" : ""}><input type="radio" name="pair" value={n} checked={pair === n} onChange={() => update({ pair: n, existing: null })}/>{n}</label>)}
        </fieldset>
        <div className="result-grid" role="group" aria-label="Sets">
          <span/>{[1, 2, 3].map(s => <span key={s} className="result-grid-head">Set {s}</span>)}
          {["Nosotros", "Rivales"].map((label, side) => <div key={label} className="result-grid-row"><span className="result-grid-label">{label}</span>{[0, 1, 2].map(set => <input key={set} inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label={`${label}, set ${set + 1}`} disabled={set === 2 && firstTwoDecided} value={cells[set][side]} onChange={e => setCell(set, side, e.target.value)}/>)}</div>)}
        </div>
        {form.message && <p role="alert" className="snp-warning">{form.message}</p>}
        {form.existing && <div className="result-existing"><p>Registrado: {form.existing.map(s => s.join("-")).join(" · ")}</p><button type="button" className="button" disabled={busy} onClick={() => void send("confirm")}>Es mi partido</button></div>}
        <div className="result-actions"><button className="button" disabled={busy}>Guardar resultado</button><button type="button" className="button secondary" disabled={busy} onClick={() => void send("absent")}>No jugué</button></div>
      </form>
    </dialog>
  </>;
}

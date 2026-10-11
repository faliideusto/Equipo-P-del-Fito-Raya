"use client";
import { useEffect, useState } from "react";
import { cellsToSets, checkSets, setsToCells, visibleCells } from "@/domain/match-result";
import type { MyResult } from "@/lib/pending-results-service";
import { ResultSetsGrid, updateCell } from "./result-sets-grid";
// The player's own result saved in the app for this fixture, editable until SNP publishes it.
export function MyMatchResult({ teamId, fixtureId }: { teamId: string; fixtureId: string }) {
  const [result, setResult] = useState<MyResult | null>(null);
  const [editing, setEditing] = useState<string[][] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/results/mine?teamId=${teamId}&fixtureId=${fixtureId}`, { signal: controller.signal, cache: "no-store" }).then(r => r.ok ? r.json() : { result: null }).then(data => setResult(data.result ?? null)).catch(() => {});
    return () => controller.abort();
  }, [teamId, fixtureId]);
  if (!result) return null;
  async function save() {
    if (!result || !editing) return;
    const sets = cellsToSets(visibleCells(editing).cells);
    const check = checkSets(sets);
    if (!check.ok) { setMessage(check.error); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit", fixtureId, teamId, pairIndex: result.pairIndex, sets }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error || "No se pudo modificar. Inténtalo de nuevo."); return; }
      setResult(data.result ?? null); setEditing(null);
    } catch { setMessage("No se pudo modificar. Comprueba la conexión."); } finally { setBusy(false); }
  }
  const view = editing && visibleCells(editing);
  return <section className="panel my-result" aria-labelledby="my-result-title">
    <div className="my-result-heading"><div><h2 id="my-result-title">Tu resultado en la app</h2><p>Pareja {result.pairIndex} · registrado por {result.submittedByName}</p></div>
      {!editing && <strong className="my-result-sets">{result.sets.map(s => s.join("-")).join(" · ")}</strong>}</div>
    {view ? <>
      <ResultSetsGrid cells={view.cells} thirdLocked={view.thirdLocked} onChange={(set, side, value) => setEditing(updateCell(editing!, set, side, value))}/>
      <div className="result-actions"><button type="button" className="button" disabled={busy} onClick={() => void save()}>Guardar cambios</button><button type="button" className="button secondary" disabled={busy} onClick={() => { setEditing(null); setMessage(""); }}>Cancelar</button></div>
    </> : result.editable ? <button type="button" className="button secondary" onClick={() => setEditing(setsToCells(result.sets))}>Modificar</button> : <p className="data-note">SNP ya ha publicado este partido: el resultado oficial es el del acta.</p>}
    {message && <p role="alert" className="snp-warning">{message}</p>}
  </section>;
}

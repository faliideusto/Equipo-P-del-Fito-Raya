"use client";
// Shared 2×3 grid (Nosotros / Rivales × Set 1-3) for entering or editing a result.
export function ResultSetsGrid({ cells, thirdLocked, onChange }: { cells: string[][]; thirdLocked: boolean; onChange: (set: number, side: number, value: string) => void }) {
  return <div className="result-grid" role="group" aria-label="Sets">
    <span/>{[1, 2, 3].map(s => <span key={s} className="result-grid-head">Set {s}</span>)}
    {["Nosotros", "Rivales"].map((label, side) => <div key={label} className="result-grid-row"><span className="result-grid-label">{label}</span>{[0, 1, 2].map(set => <input key={set} inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label={`${label}, set ${set + 1}`} disabled={set === 2 && thirdLocked} value={cells[set][side]} onChange={e => onChange(set, side, e.target.value.replace(/\D/g, ""))}/>)}</div>)}
  </div>;
}
export const updateCell = (cells: string[][], set: number, side: number, value: string) => cells.map((row, i) => i === set ? row.map((v, j) => j === side ? value : v) : row);

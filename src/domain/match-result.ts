export type SetScore = [number, number];
export type SetsCheck = { ok: true; sets: SetScore[]; won: boolean; thirdSetNeeded: boolean } | { ok: false; error: string; thirdSetNeeded: boolean };
const games = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 99;
const asSet = (value: unknown): SetScore | null | undefined => value === null ? null : Array.isArray(value) && value.length === 2 && games(value[0]) && games(value[1]) ? [value[0], value[1]] : undefined;
const order = ([a, b]: SetScore) => a > b ? [a, b] : [b, a];
export function isRegularSet(set: SetScore) { const [w, l] = order(set); return (w === 6 && l <= 4) || (w === 7 && (l === 5 || l === 6)); }
export function isSuperTieBreak(set: SetScore) { const [w, l] = order(set); return w === 10 ? l <= 8 : w > 10 && w - l === 2; }
// Sets are always stored from our side: [nosotros, rivales].
export function checkSets(input: unknown): SetsCheck {
  const fail = (error: string, thirdSetNeeded = false): SetsCheck => ({ ok: false, error, thirdSetNeeded });
  if (!Array.isArray(input) || input.length < 2 || input.length > 3) return fail("Introduce al menos los dos primeros sets.");
  const sets = [0, 1, 2].map(i => asSet(input[i] ?? null));
  for (let i = 0; i < 3; i++) if (sets[i] === undefined) return fail(`Completa los dos lados del set ${i + 1} con números.`);
  const [first, second, third] = sets as (SetScore | null)[];
  if (!first || !second) return fail("Los sets 1 y 2 son obligatorios.");
  for (const [i, set] of [first, second].entries()) if (!isRegularSet(set)) return fail(`El set ${i + 1} no es un marcador válido (6-0 a 6-4, 7-5 o 7-6).`);
  const thirdSetNeeded = first[0] > first[1] !== second[0] > second[1];
  if (!thirdSetNeeded) return third ? fail("Con dos sets ganados por la misma pareja, deja vacío el tercero.") : { ok: true, sets: [first, second], won: first[0] > first[1], thirdSetNeeded };
  if (!third) return fail("Con un set para cada pareja, el tercer set es obligatorio.", true);
  if (!isRegularSet(third) && !isSuperTieBreak(third)) return fail("El tercer set no es válido (set normal o súper tie-break a 10 con dos de diferencia).", true);
  return { ok: true, sets: [first, second, third], won: third[0] > third[1], thirdSetNeeded };
}
export function cellsToSets(cells: string[][]): unknown {
  return cells.slice(0, 3).map(([ours = "", theirs = ""]) => {
    if (!ours.trim() && !theirs.trim()) return null;
    return [ours.trim() ? Number(ours) : NaN, theirs.trim() ? Number(theirs) : NaN];
  });
}

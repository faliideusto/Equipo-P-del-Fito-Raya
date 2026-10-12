import { matchValue } from "./rules";
import type { SetScore } from "./match-result";
// Puntos SNP de un partido, deducidos del historial de SNP (ver docs/puntos-snp.md):
// coeficiente de división × (puntos por resultado + bonus del enfrentamiento).
// Los puntos del compañero o de los rivales no influyen.
const RESULT_POINTS = { won2: 5, won3: 4, lost3: 2, lost2: 1 } as const;
// 1ª = 1; −5 % por división hasta la 6ª; −1 % por división desde la 7ª; nunca menos de 0,50.
export function divisionCoefficient(division: number): number {
  if (!Number.isInteger(division) || division < 1) return 1;
  const value = division <= 6 ? 1 - 0.05 * (division - 1) : 0.75 - 0.01 * (division - 6);
  return Math.max(0.5, Math.round(value * 100) / 100);
}
// El coeficiente solo se aplica en la fase regular; el título del acta trae fase y división.
// null si el título no dice la división (por ejemplo, un acta guardada sin consultar SNP).
export function actaCoefficient(title: string): number | null {
  const division = title.match(/(\d+)\s*ª\s*Divisi[oó]n/i)?.[1];
  if (!division) return null;
  return /FASE REGULAR/i.test(title) ? divisionCoefficient(Number(division)) : 1;
}
const setsWon = (sets: SetScore[], side: 0 | 1) => sets.filter(s => s[side] > s[1 - side]).length;
// Resultado de un lado del partido: null mientras no hay ganador.
export function gameResultPoints(gameIndex: number, sets: SetScore[], side: 0 | 1): number | null {
  const own = setsWon(sets, side); const rival = setsWon(sets, side === 0 ? 1 : 0);
  if (own < 2 && rival < 2) return null;
  const threeSets = own + rival === 3;
  const base = own >= 2 ? (threeSets ? RESULT_POINTS.won3 : RESULT_POINTS.won2) : (threeSets ? RESULT_POINTS.lost3 : RESULT_POINTS.lost2);
  // Los partidos de 3 puntos (parejas 1 y 2) suman 2 más, ganes o pierdas.
  return base + (matchValue(gameIndex) === 3 ? 2 : 0);
}
// +1 si el equipo gana el enfrentamiento, +0,5 si empata. null si aún faltan partidos.
export function teamBonus(gameSets: (SetScore[] | null)[], side: 0 | 1): number | null {
  if (gameSets.length !== 5) return null;
  const score = [0, 0];
  for (const [index, sets] of gameSets.entries()) {
    if (!sets) return null;
    const winner = setsWon(sets, 0) >= 2 ? 0 : setsWon(sets, 1) >= 2 ? 1 : null;
    if (winner === null) return null;
    score[winner] += matchValue(index);
  }
  const rival = side === 0 ? 1 : 0;
  return score[side] > score[rival] ? 1 : score[side] === score[rival] ? 0.5 : 0;
}
export type PointsForecast = { points: number; withBonus: boolean };
// Previsión para cada lado [local, visitante] de cada partido del acta.
export function actaForecast(title: string, gameSets: (SetScore[] | null)[]): ([PointsForecast | null, PointsForecast | null])[] {
  const coefficient = actaCoefficient(title);
  return gameSets.map((sets, index) => ([0, 1] as const).map(side => {
    const result = sets && index < 5 && coefficient !== null ? gameResultPoints(index, sets, side) : null;
    if (result === null) return null;
    const bonus = teamBonus(gameSets, side);
    return { points: Math.round(coefficient! * (result + (bonus ?? 0)) * 1000) / 1000, withBonus: bonus !== null };
  }) as [PointsForecast | null, PointsForecast | null]);
}
// Historial de SNP de un jugador en un grupo (ranking/ajaxGetByJugadorAndGrupo):
// `datos` es la temporada actual y `datos_ant` la anterior, por fase y jornada.
type RawRound = { ptos_c?: unknown; pd?: unknown; puntos?: unknown };
type RawPhase = { nombre?: unknown; j_a?: unknown; J?: unknown };
export type RankingHistory = { current: Record<string, RawPhase>; previous: Record<string, RawPhase> };
const num = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
const roundOrder = (key: string) => key === "retos" ? 5.5 : Number(key);
const rounds = (phase: RawPhase | undefined) => phase?.J && typeof phase.J === "object" && !Array.isArray(phase.J) ? Object.entries(phase.J as Record<string, RawRound>).filter(([key, row]) => row && Number.isFinite(roundOrder(key))) : [];
const sameName = (phase: RawPhase, title: string) => typeof phase.nombre === "string" && phase.nombre.trim() !== "" && title.toUpperCase().includes(phase.nombre.trim().toUpperCase());
export type RankingForecast = { before: number; after: number; published: boolean };
export type PlayerRanking = RankingForecast & { withBonus: boolean };
// Ranking = 100.000 × puntos de la ventana / (8 × máx(4, partidos de la ventana)).
// La ventana es un año: al jugar la jornada N cae la jornada N (y antes, los retos) de la temporada pasada.
export function rankingForecast(history: RankingHistory, title: string, round: number, gained: number, lineupPoints: number | null = null): RankingForecast | null {
  const phase = Object.values(history.current).find(p => sameName(p, title));
  if (!phase) return null;
  const done = rounds(phase).filter(([key]) => roundOrder(key) < round);
  const previousRow = done.sort(([a], [b]) => roundOrder(a) - roundOrder(b)).at(-1)?.[1];
  // El ranking de partida es el de la convocatoria del acta, el que se muestra junto al jugador:
  // SNP ya le ha quitado la jornada de hace un año, así que la variación es solo la de este partido
  // y la suma cuadra, igual en la previsión que en el dato publicado. Sin él, el de la jornada anterior.
  const before = lineupPoints ?? (previousRow ? num(previousRow.puntos) : null);
  const row = num(phase.j_a) >= round ? rounds(phase).find(([key]) => roundOrder(key) === round)?.[1] : undefined;
  // SNP abre la jornada al llegar la fecha y solo cuenta el partido al confirmar el acta: hasta
  // entonces su fila no tiene partido (pd) y el ranking solo ha perdido la jornada de hace un año.
  const counted = row && num(row.pd) >= 1;
  if (counted && before !== null) return { before, after: num(row.puntos), published: true };
  let points = gained; let played = 1;
  for (const [, row] of done) { points += num(row.ptos_c); played += num(row.pd); }
  for (const old of Object.values(history.previous)) {
    // La fase regular de la temporada pasada puede ser de otra zona (otro nombre).
    const regular = typeof old.nombre === "string" && /REGULAR/i.test(old.nombre);
    for (const [key, row] of rounds(old)) if (!regular || roundOrder(key) > round) { points += num(row.ptos_c); played += num(row.pd); }
  }
  const after = Math.round(12500 * points / Math.max(4, played) * 100) / 100;
  // Sin convocatoria y con la jornada abierta se parte del ranking que SNP da ahora.
  const from = lineupPoints === null && row ? num(row.puntos) : before;
  return from === null ? null : { before: from, after, published: false };
}

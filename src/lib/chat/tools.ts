import type { Fixture, Player, Position, Standing, TeamId } from "@/domain/types";
import type { SnpMatch } from "@/domain/snp";
import type { PlayerWinRate } from "@/domain/player-winrate";
import type { SavedLineup } from "@/lib/saved-lineups";
import type { ChatRole, LlmTool } from "./types";

// Read-only views of the club data for the model. Every result is small JSON in Spanish, with names instead of ids.
export type RankingRow = { player: Player; played: number; won: number; lost: number; points: number };
export interface ChatData {
  players(team: TeamId): Promise<Player[]>;
  fixtures(team: TeamId): Promise<Fixture[]>;
  standings(team: TeamId): Promise<Standing[]>;
  ranking(team: TeamId): Promise<RankingRow[]>;
  match(fixtureId: string): Promise<SnpMatch>;
  winRate(player: Player): Promise<PlayerWinRate | null>;
  availability(team: TeamId, fixtureId: string): Promise<string[] | null>;
  lineups(team: TeamId): Promise<SavedLineup[]>;
}
type Args = Record<string, unknown>;
type Tool = { def: LlmTool; coach: boolean; run(args: Args, data: ChatData): Promise<unknown> };
class ToolInputError extends Error {}
const MAX_RESULT = 6000;

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es").trim();
const POSITION: Record<Position, string> = { RIGHT: "derecha", LEFT: "revés", BOTH: "ambos lados" };
const position = (p: Position | null) => p ? POSITION[p] : "sin indicar";
function team(args: Args): TeamId {
  if (args.equipo === "a" || args.equipo === "b") return args.equipo;
  throw new ToolInputError("equipo debe ser 'a' o 'b'");
}
function round(args: Args): number | null {
  if (args.jornada === undefined || args.jornada === null) return null;
  const value = Number(args.jornada);
  if (Number.isInteger(value) && value >= 1 && value <= 40) return value;
  throw new ToolInputError("jornada debe ser un número entre 1 y 40");
}
async function fixtureFor(args: Args, data: ChatData, required: boolean) {
  const fixtures = await data.fixtures(team(args)); const wanted = round(args);
  if (wanted === null && required) throw new ToolInputError("falta la jornada");
  const fixture = wanted === null ? fixtures.find(f => f.status === "pending") : fixtures.find(f => f.round === wanted);
  if (!fixture) throw new ToolInputError(wanted === null ? "no quedan jornadas pendientes" : `no existe la jornada ${wanted} para ese equipo`);
  return fixture;
}
// SNP dates come in UTC; the model must read Madrid time or it gets kick-off two hours early.
const MADRID = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "full", timeStyle: "short" });
function when(date: string) {
  if (!date) return "sin fecha";
  return /(z|[+-]\d\d:?\d\d)$/i.test(date) && !Number.isNaN(Date.parse(date)) ? MADRID.format(new Date(date)) : date;
}
const names = (ids: (string | null)[], players: Player[]) => ids.map(id => players.find(p => p.id === id)?.name ?? "hueco libre").join(" / ");

// The model compares percentages badly and drops ties, so both come computed.
type Ranked = { posicion: number; jugador: string; jugados: number; ganados: number; perdidos: number; puntos: number; porcentaje_victorias: number | null; equipo?: string };
const rankRows = (rows: RankingRow[]): Ranked[] => rows.map((r, i) => ({ posicion: i + 1, jugador: r.player.name, jugados: r.played, ganados: r.won, perdidos: r.lost, puntos: r.points, porcentaje_victorias: r.won + r.lost ? Math.round(100 * r.won / (r.won + r.lost)) : null }));
function bestOf(rows: Ranked[]) {
  const best = Math.max(-1, ...rows.map(r => r.porcentaje_victorias ?? -1));
  if (best < 0) return null;
  const tied = rows.filter(r => r.porcentaje_victorias === best).sort((x, y) => y.ganados + y.perdidos - (x.ganados + x.perdidos));
  const empatados = tied.map(r => `${r.jugador} (${r.equipo ? `${r.equipo}, ` : ""}${r.ganados}-${r.perdidos})`);
  const list = empatados.length > 1 ? `${empatados.slice(0, -1).join(", ")} y ${empatados.at(-1)}` : empatados[0];
  return { porcentaje: best, empatados, texto: empatados.length > 1 ? `${empatados.length} jugadores empatados al ${best}%: ${list}.` : `${list} tiene el mejor porcentaje: ${best}%.` };
}
const DAY = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "full" });
const TIME = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", timeStyle: "short" });
// Separate fields: with day and time in one string the model tends to drop the time.
function dayTime(date: string) {
  if (!date) return { dia: "sin fecha", hora: null };
  return /(z|[+-]\d\d:?\d\d)$/i.test(date) && !Number.isNaN(Date.parse(date)) ? { dia: DAY.format(new Date(date)), hora: TIME.format(new Date(date)) } : { dia: date, hora: null };
}
// SNP publishes the venue in the acta, also before the match; at home it is the club's own.
const AWAY_UNKNOWN = "fuera, sede sin publicar en SNP";
async function venueOf(fixture: Fixture, data: ChatData) {
  if (fixture.home) return "en casa";
  try { return (await data.match(fixture.id)).venue ?? AWAY_UNKNOWN; } catch { return AWAY_UNKNOWN; }
}
// The model picks badly from a long list, so the rounds people ask about come already resolved.
async function calendar(id: TeamId, data: ChatData) {
  const fixtures = await data.fixtures(id);
  // A double round robin: the first leg ends halfway through the rounds, byes included.
  const half = Math.ceil(Math.max(0, ...fixtures.map(f => f.round)) / 2);
  const highlight = async (f: Fixture | undefined) => {
    if (!f) return null;
    const estado = f.status === "played" ? "jugado" : "pendiente"; const { dia, hora } = dayTime(f.date); const lugar = await venueOf(f, data);
    const where = f.home ? "en casa" : lugar === AWAY_UNKNOWN ? "fuera (sede sin publicar en SNP)" : `fuera contra ${f.opponent}, en ${lugar}`;
    // A ready sentence: the model copies it instead of merging fields, which it gets wrong.
    const resumen = `Equipo ${id.toUpperCase()} · Jornada ${f.round} (${estado}): ${dia}${hora ? ` a las ${hora}` : ""}, ${f.home ? `en casa contra ${f.opponent}` : where.startsWith("fuera contra") ? where : `${where} contra ${f.opponent}`}.`;
    return { jornada: f.round, estado, rival: f.opponent, dia, hora, campo: f.home ? "en casa" : "fuera", lugar, resumen };
  };
  const firstLeg = fixtures.filter(f => f.round <= half);
  const [proxima, ultima_jugada, ultima_de_primera_vuelta, primera_de_segunda_vuelta] = await Promise.all([
    highlight(fixtures.find(f => f.status === "pending")),
    highlight(fixtures.filter(f => f.status === "played").at(-1)),
    highlight(firstLeg.at(-1)),
    highlight(fixtures.find(f => f.round > half)),
  ]);
  return {
    destacadas: { proxima, ultima_jugada, ultima_de_primera_vuelta, primera_de_segunda_vuelta },
    jornadas: fixtures.map(f => {
      const ours = f.score ? (f.home ? f.score : [f.score[1], f.score[0]]) : null;
      return { jornada: f.round, vuelta: f.round <= half ? 1 : 2, rival: f.opponent, fecha: when(f.date), campo: f.home ? "en casa" : "fuera", estado: f.status === "played" ? "jugado" : "pendiente", resultado: ours ? `${ours[0]}-${ours[1]} (club-rival)` : null };
    }),
  };
}
const TEAM = { type: "string", enum: ["a", "b"], description: "Equipo del club: a (2ª División) o b (10ª División)" };
const ROUND = { type: "integer", description: "Número de jornada" };
const tool = (name: string, description: string, properties: Args, required: string[], coach: boolean, run: Tool["run"]): Tool =>
  ({ def: { type: "function", function: { name, description, parameters: { type: "object", properties, required } } }, coach, run });

const TOOLS: Tool[] = [
  tool("calendario", "Calendario de un equipo. destacadas trae ya resueltas, con hora y lugar: proxima, ultima_jugada, ultima_de_primera_vuelta y primera_de_segunda_vuelta. jornadas lista todas con vuelta (1 o 2), rival, fecha, campo y resultado (club-rival). Sin equipo devuelve los dos.", { equipo: TEAM }, [], false, async (args, data) => {
    if (args.equipo === undefined || args.equipo === null) {
      const [a, b] = await Promise.all([calendar("a", data), calendar("b", data)]);
      return { equipo_a: a, equipo_b: b };
    }
    return calendar(team(args), data);
  }),
  tool("clasificacion", "Clasificación oficial de la división de un equipo.", { equipo: TEAM }, ["equipo"], false, async (args, data) =>
    (await data.standings(team(args))).map((s, i) => ({ posicion: i + 1, equipo: s.name, jugados: s.played, ganados: s.won, perdidos: s.lost, puntos: s.points, es_nuestro: Boolean(s.own) }))),
  tool("ranking_temporada", "Ranking interno de jugadores esta temporada con el club: partidos, puntos aportados y porcentaje de victorias (winrate), con los empatados en el mejor porcentaje. Sin equipo devuelve los dos equipos y el mejor porcentaje de todo el club.", { equipo: TEAM }, [], false, async (args, data) => {
    if (args.equipo === undefined || args.equipo === null) {
      const [a, b] = await Promise.all([data.ranking("a"), data.ranking("b")]);
      const ra = rankRows(a); const rb = rankRows(b);
      return { equipo_a: { jugadores: ra }, equipo_b: { jugadores: rb }, mejor_porcentaje_club: bestOf([...ra.map(r => ({ ...r, equipo: "A" })), ...rb.map(r => ({ ...r, equipo: "B" }))]) };
    }
    const rows = rankRows(await data.ranking(team(args)));
    return { jugadores: rows, mejor_porcentaje: bestOf(rows) };
  }),
  tool("acta", "Datos de una jornada: fecha, rival, lugar (sede) y, si ya se jugó, parejas y sets.", { equipo: TEAM, jornada: ROUND }, ["equipo", "jornada"], false, async (args, data) => {
    const fixture = await fixtureFor(args, data, true);
    if (fixture.status === "pending") return { jornada: fixture.round, rival: fixture.opponent, fecha: when(fixture.date), estado: "pendiente", lugar: await venueOf(fixture, data) };
    const match = await data.match(fixture.id); const side = fixture.home ? 0 : 1;
    return { jornada: fixture.round, rival: fixture.opponent, lugar: fixture.home ? "en casa" : match.venue ?? AWAY_UNKNOWN, parejas: match.games.map(g => ({
      pareja: g.index + 1,
      nuestros: (side === 0 ? g.homePlayers : g.awayPlayers).join(" / "),
      rivales: (side === 0 ? g.awayPlayers : g.homePlayers).join(" / "),
      sets: g.sets.map(s => `${s[side]}-${s[1 - side]}`).join(", "),
      ganada: g.sets.filter(s => s[side] > s[1 - side]).length >= 2,
    })) };
  }),
  tool("jugador", "Ficha de un jugador del club buscado por nombre: equipos, puntos SNP, posición y victorias de la temporada.", { nombre: { type: "string", description: "Nombre o apellido" } }, ["nombre"], false, async (args, data) => {
    const query = typeof args.nombre === "string" ? fold(args.nombre) : "";
    if (query.length < 2) throw new ToolInputError("nombre debe tener al menos 2 letras");
    const found = new Map<string, { player: Player; teams: string[] }>();
    for (const t of ["a", "b"] as const) for (const p of await data.players(t)) {
      if (!fold(p.name).includes(query)) continue;
      const row = found.get(p.id) ?? { player: p, teams: [] };
      row.teams.push(t.toUpperCase()); found.set(p.id, row);
    }
    if (!found.size) return { encontrados: 0 };
    const rows = [...found.values()];
    if (rows.length > 5) return { encontrados: rows.length, nombres: rows.map(r => r.player.name), nota: "Pide al usuario que concrete" };
    return Promise.all(rows.map(async ({ player, teams }) => {
      const wr = await data.winRate(player);
      return { jugador: player.name, equipos: teams, puntos: player.points, posicion: position(player.position), partidos_temporada: wr ? { ganados: wr.won, perdidos: wr.lost, porcentaje: wr.percentage === null ? null : Math.round(wr.percentage) } : null };
    }));
  }),
  tool("disponibilidad", "Jugadores apuntados como disponibles para una jornada (por defecto, la próxima).", { equipo: TEAM, jornada: ROUND }, ["equipo"], true, async (args, data) => {
    const fixture = await fixtureFor(args, data, false);
    const [ids, roster] = await Promise.all([data.availability(team(args), fixture.id), data.players(team(args))]);
    if (ids === null) return { jornada: fixture.round, rival: fixture.opponent, guardada: false, nota: "Todavía no se ha guardado la lista de disponibles de esta jornada." };
    return { jornada: fixture.round, rival: fixture.opponent, fecha: when(fixture.date), disponibles: roster.filter(p => ids.includes(p.id)).map(p => p.name), no_disponibles: roster.filter(p => !ids.includes(p.id)).map(p => p.name) };
  }),
  tool("posiciones_y_parejas", "Posición (derecha/revés) y puntos de cada jugador, y alineaciones guardadas del equipo.", { equipo: TEAM }, ["equipo"], true, async (args, data) => {
    const [roster, saved] = await Promise.all([data.players(team(args)), data.lineups(team(args))]);
    return {
      jugadores: [...roster].sort((x, y) => (y.points ?? 0) - (x.points ?? 0)).map(p => ({ jugador: p.name, posicion: position(p.position), puntos: p.points })),
      alineaciones_guardadas: saved.slice(-5).map(l => ({ nombre: l.name, parejas: l.pairs.map((pair, i) => `${i + 1}: ${names(pair.players, roster)}`) })),
    };
  }),
];

export function toolsFor(role: ChatRole) { return TOOLS.filter(t => role === "coach" || !t.coach).map(t => t.def); }

export async function runTool(name: string, args: unknown, role: ChatRole, data: ChatData): Promise<string> {
  const found = TOOLS.find(t => t.def.function.name === name);
  if (!found || (found.coach && role !== "coach")) return JSON.stringify({ error: `Herramienta no disponible: ${name}` });
  try {
    const text = JSON.stringify(await found.run(args && typeof args === "object" ? args as Args : {}, data));
    return text.length > MAX_RESULT ? `${text.slice(0, MAX_RESULT)}…(recortado)` : text;
  } catch (error) {
    return JSON.stringify({ error: error instanceof ToolInputError ? error.message : "No se pudieron consultar los datos ahora mismo." });
  }
}

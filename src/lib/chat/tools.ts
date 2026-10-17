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
// Fits both teams' calendars of a 10-round league (about 6500 characters) inside the model's 8192-token context.
const MAX_RESULT = 9000;

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
// Without a round: the next pending one, or the last played one ("¿quién jugó?").
async function fixtureFor(args: Args, data: ChatData, fallback: "pending" | "played") {
  const fixtures = await data.fixtures(team(args)); const wanted = round(args);
  const fixture = wanted !== null ? fixtures.find(f => f.round === wanted) : fallback === "pending" ? fixtures.find(f => f.status === "pending") : fixtures.filter(f => f.status === "played").at(-1);
  if (!fixture) throw new ToolInputError(wanted === null ? fallback === "pending" ? "no quedan jornadas pendientes" : "todavía no se ha jugado ninguna jornada"
    : restRounds(fixtures).includes(wanted) ? `el equipo descansa en la jornada ${wanted} (no tiene partido)` : `no existe la jornada ${wanted} para ese equipo`);
  return fixture;
}
// Rounds missing inside the season are byes: the model otherwise says the round does not exist.
function restRounds(fixtures: Fixture[]) {
  const rounds = new Set(fixtures.map(f => f.round));
  return Array.from({ length: Math.max(0, ...rounds) }, (_, i) => i + 1).filter(r => !rounds.has(r));
}
const ours = (f: Fixture) => f.score ? (f.home ? f.score : [f.score[1], f.score[0]]) : null;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
// The model miscounts lists (it summed player wins as team wins), so the tally comes ready.
function balance(id: TeamId, fixtures: Fixture[]) {
  const scores = fixtures.filter(f => f.status === "played").map(ours).filter(s => s !== null);
  const ganados = scores.filter(s => s[0] > s[1]).length; const empatados = scores.filter(s => s[0] === s[1]).length; const perdidos = scores.length - ganados - empatados;
  const pendientes = fixtures.filter(f => f.status === "pending").length;
  return { jugados: scores.length, ganados, empatados, perdidos, pendientes,
    texto: `Equipo ${id.toUpperCase()}: ${plural(scores.length, "encuentro jugado", "encuentros jugados")} (${plural(ganados, "ganado", "ganados")}, ${plural(empatados, "empatado", "empatados")} y ${plural(perdidos, "perdido", "perdidos")}) y ${plural(pendientes, "pendiente", "pendientes")}.` };
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
// label names the team: with one call per team the model otherwise keeps only the last team's text.
function bestOf(rows: Ranked[], label = "") {
  const best = Math.max(-1, ...rows.map(r => r.porcentaje_victorias ?? -1));
  if (best < 0) return null;
  const tied = rows.filter(r => r.porcentaje_victorias === best).sort((x, y) => y.ganados + y.perdidos - (x.ganados + x.perdidos));
  const empatados = tied.map(r => `${r.jugador} (${r.equipo ? `${r.equipo}, ` : ""}${r.ganados}-${r.perdidos})`);
  const list = empatados.length > 1 ? `${empatados.slice(0, -1).join(", ")} y ${empatados.at(-1)}` : empatados[0];
  return { porcentaje: best, empatados, texto: label + (empatados.length > 1 ? `${empatados.length} jugadores empatados al ${best}%: ${list}.` : `${list} tiene el mejor porcentaje: ${best}%.`) };
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
// Pairs from the club's side: SNP lists home first.
function pairsOf(fixture: Fixture, match: SnpMatch) {
  const side = fixture.home ? 0 : 1;
  return match.games.map(g => ({
    pareja: g.index + 1,
    nuestros: (side === 0 ? g.homePlayers : g.awayPlayers).join(" / "),
    rivales: (side === 0 ? g.awayPlayers : g.homePlayers).join(" / "),
    sets: g.sets.map(s => `${s[side]}-${s[1 - side]}`).join(", "),
    ganada: g.sets.filter(s => s[side] > s[1 - side]).length >= 2,
  }));
}
// The model picks badly from a long list, so the rounds people ask about come already resolved.
async function calendar(id: TeamId, data: ChatData) {
  const fixtures = await data.fixtures(id);
  // A double round robin: the first leg ends halfway through the rounds, byes included.
  const half = Math.ceil(Math.max(0, ...fixtures.map(f => f.round)) / 2);
  // The label goes in the sentence too: the model finds "última jornada de la primera vuelta" by its words, not by the key.
  const highlight = async (f: Fixture | undefined, label: string) => {
    if (!f) return null;
    const estado = f.status === "played" ? "jugado" : "pendiente"; const { dia, hora } = dayTime(f.date); const lugar = await venueOf(f, data);
    const where = f.home ? "en casa" : lugar === AWAY_UNKNOWN ? "fuera (sede sin publicar en SNP)" : `fuera contra ${f.opponent}, en ${lugar}`;
    // A ready sentence: the model copies it instead of merging fields, which it gets wrong.
    const score = ours(f); const resultado = score ? `${score[0]}-${score[1]} (club-rival)` : null;
    // Who played comes with the last played round: the model does not reach for acta on its own.
    const parejas = f.status === "played" ? await data.match(f.id).then(m => pairsOf(f, m).map(p => `Pareja ${p.pareja}: ${p.nuestros} contra ${p.rivales}, ${p.sets} (${p.ganada ? "ganada" : "perdida"})`), () => null) : null;
    // The verb carries the tense: from the bare date the model calls pending rounds "jugada".
    const played = f.status === "played"; const date = f.date ? `${played ? "se jugó" : "se juega"} el ${dia}${hora ? ` a las ${hora}` : ""}` : "sin fecha";
    const resumen = `Equipo ${id.toUpperCase()} · ${label} · Jornada ${f.round} (${played ? "jugada" : "pendiente"}): ${date}, ${f.home ? `en casa contra ${f.opponent}` : where.startsWith("fuera contra") ? where : `${where} contra ${f.opponent}`}${resultado ? `, resultado ${resultado}` : ""}.`;
    return { jornada: f.round, estado, rival: f.opponent, dia, hora, campo: f.home ? "en casa" : "fuera", lugar, ...(resultado ? { resultado } : {}), resumen, ...(parejas ? { parejas } : {}) };
  };
  const firstLeg = fixtures.filter(f => f.round <= half);
  const pending = fixtures.filter(f => f.status === "pending");
  // Not "ultima_jugada": next to ultima_de_primera_vuelta the model mixes the two up.
  const [proxima, siguiente_a_la_proxima, jugada_mas_reciente, ultima_de_primera_vuelta, primera_de_segunda_vuelta] = await Promise.all([
    highlight(pending[0], "Próxima jornada"),
    highlight(pending[1], "Siguiente a la próxima"),
    highlight(fixtures.filter(f => f.status === "played").at(-1), "Jugada más reciente"),
    highlight(firstLeg.at(-1), "Última jornada de la primera vuelta"),
    highlight(fixtures.find(f => f.round > half), "Primera jornada de la segunda vuelta"),
  ]);
  return {
    destacadas: { proxima, siguiente_a_la_proxima, jugada_mas_reciente, ultima_de_primera_vuelta, primera_de_segunda_vuelta },
    balance: balance(id, fixtures),
    // Byes are listed among the rounds: a separate list was ignored and the model called them unplayed.
    jornadas: [
      ...fixtures.map(f => {
        const score = ours(f);
        return { jornada: f.round, vuelta: f.round <= half ? 1 : 2, rival: f.opponent, fecha: when(f.date), campo: f.home ? "en casa" : "fuera", estado: f.status === "played" ? "jugado" : "pendiente", resultado: score ? `${score[0]}-${score[1]} (club-rival)` : null };
      }),
      ...restRounds(fixtures).map(r => ({ jornada: r, vuelta: r <= half ? 1 : 2, estado: "descanso", nota: `El equipo ${id.toUpperCase()} descansa: no tiene partido en la jornada ${r}.` })),
    ].sort((x, y) => x.jornada - y.jornada),
  };
}
const TEAM = { type: "string", enum: ["a", "b"], description: "Equipo del club: a (2ª División) o b (10ª División)" };
const ROUND = { type: "integer", description: "Número de jornada" };
const tool = (name: string, description: string, properties: Args, required: string[], coach: boolean, run: Tool["run"]): Tool =>
  ({ def: { type: "function", function: { name, description, parameters: { type: "object", properties, required } } }, coach, run });

const TOOLS: Tool[] = [
  tool("calendario", "Calendario de un equipo. destacadas trae ya resueltas, con hora y lugar: proxima, siguiente_a_la_proxima, jugada_mas_reciente (con quién jugó en cada pareja), ultima_de_primera_vuelta y primera_de_segunda_vuelta. balance cuenta los encuentros ganados, empatados, perdidos y pendientes del equipo. jornadas lista todas con vuelta (1 o 2), rival, fecha, campo y resultado (club-rival), y las de descanso. Sin equipo devuelve los dos.", { equipo: TEAM }, [], false, async (args, data) => {
    if (args.equipo === undefined || args.equipo === null) {
      const [a, b] = await Promise.all([calendar("a", data), calendar("b", data)]);
      return { equipo_a: a, equipo_b: b };
    }
    return calendar(team(args), data);
  }),
  tool("clasificacion", "Clasificación oficial de la división de un equipo.", { equipo: TEAM }, ["equipo"], false, async (args, data) =>
    (await data.standings(team(args))).map((s, i) => ({ posicion: i + 1, equipo: s.name, jugados: s.played, ganados: s.won, perdidos: s.lost, puntos: s.points, es_nuestro: Boolean(s.own) }))),
  tool("ranking_temporada", "Ranking interno de jugadores (no del equipo) esta temporada con el club: partidos, puntos aportados y porcentaje de victorias (winrate), con los empatados en el mejor porcentaje. Sin equipo devuelve los dos equipos y el mejor porcentaje de todo el club.", { equipo: TEAM }, [], false, async (args, data) => {
    if (args.equipo === undefined || args.equipo === null) {
      const [a, b] = await Promise.all([data.ranking("a"), data.ranking("b")]);
      const ra = rankRows(a); const rb = rankRows(b);
      return { equipo_a: { jugadores: ra }, equipo_b: { jugadores: rb }, mejor_porcentaje_club: bestOf([...ra.map(r => ({ ...r, equipo: "A" })), ...rb.map(r => ({ ...r, equipo: "B" }))]) };
    }
    const id = team(args); const rows = rankRows(await data.ranking(id));
    return { jugadores: rows, mejor_porcentaje: bestOf(rows, `Equipo ${id.toUpperCase()}: `) };
  }),
  tool("acta", "Quién jugó en cada pareja y los sets de una jornada jugada (sin jornada, la última jugada); de una pendiente, fecha, rival y lugar (sede).", { equipo: TEAM, jornada: ROUND }, ["equipo"], false, async (args, data) => {
    const fixture = await fixtureFor(args, data, "played");
    if (fixture.status === "pending") return { jornada: fixture.round, rival: fixture.opponent, fecha: when(fixture.date), estado: "pendiente", lugar: await venueOf(fixture, data) };
    const match = await data.match(fixture.id);
    return { jornada: fixture.round, rival: fixture.opponent, lugar: fixture.home ? "en casa" : match.venue ?? AWAY_UNKNOWN, parejas: pairsOf(fixture, match) };
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
    const fixture = await fixtureFor(args, data, "pending");
    const [ids, roster] = await Promise.all([data.availability(team(args), fixture.id), data.players(team(args))]);
    // Labelled: asked for both teams, the model otherwise gives one team's list as the other's.
    const equipo = team(args).toUpperCase();
    if (ids === null) return { equipo, jornada: fixture.round, rival: fixture.opponent, guardada: false, nota: `Equipo ${equipo}: todavía no se ha guardado la lista de disponibles de esta jornada.` };
    return { equipo, jornada: fixture.round, rival: fixture.opponent, fecha: when(fixture.date), disponibles: roster.filter(p => ids.includes(p.id)).map(p => p.name), no_disponibles: roster.filter(p => !ids.includes(p.id)).map(p => p.name) };
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

// team is the chat's team selector: it fills in a team the model left out, never one it named.
export async function runTool(name: string, args: unknown, role: ChatRole, data: ChatData, team: TeamId | null = null): Promise<string> {
  const found = TOOLS.find(t => t.def.function.name === name);
  if (!found || (found.coach && role !== "coach")) return JSON.stringify({ error: `Herramienta no disponible: ${name}` });
  try {
    const given = args && typeof args === "object" ? args as Args : {};
    const text = JSON.stringify(await found.run(team && (given.equipo === undefined || given.equipo === null) ? { ...given, equipo: team } : given, data));
    return text.length > MAX_RESULT ? `${text.slice(0, MAX_RESULT)}…(recortado)` : text;
  } catch (error) {
    return JSON.stringify({ error: error instanceof ToolInputError ? error.message : "No se pudieron consultar los datos ahora mismo." });
  }
}

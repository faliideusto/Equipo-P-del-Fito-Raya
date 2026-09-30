import { load } from "cheerio";
import type { SnpOption, SnpTeam, SnpStanding, SnpFixture, SnpMatch } from "@/domain/snp";
import type { SnpPlayerStats } from "@/domain/snp";
import { snpDate } from "./snp-date";

export function snpNumber(value: unknown): number {
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "").split("/")[0].trim();
  const parsed = Number(text.includes(",") ? text.replaceAll(".", "").replace(",", ".") : text);
  return Number.isFinite(parsed) ? parsed : 0;
}
export function photoUrl(value: string | undefined): string | null {
  if (!value || value.includes("no_image")) return null;
  let url: URL;
  try { url = new URL(value, "https://snpgalaxy.com"); } catch { return null; }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== "snpgalaxy.com" || !url.pathname.startsWith("/public/files/usuario/")) return null;
  url.search = "";
  return url.toString();
}
export function parseOptions(html: string, selector: string): SnpOption[] {
  const $ = load(html);
  return $(selector).find("option").toArray().map(el => ({id: $(el).attr("value") ?? "", name: $(el).text().trim()})).filter(o => /^\d+$/.test(o.id) && o.id !== "00");
}
export function parseTeam(html: string, id: string): SnpTeam {
  const $ = load(html);
  const table = $("table").filter((_, el) => /PUNTOS|RANKING NACIONAL/.test($(el).find("th").text().toUpperCase())).first();
  const players = table.find("tbody tr").toArray().flatMap(row => {
    const cells = $(row).find("td"); const sourceId = cells.eq(0).text().trim();
    if (!/^\d+$/.test(sourceId)) return [];
    const name = cells.eq(1).find("a").first().text().trim() || cells.eq(1).clone().children("small,span.badge").remove().end().text().trim();
    return [{id: sourceId, name, points: snpNumber(cells.eq(2).text()), photoUrl: photoUrl(cells.eq(1).find("img").attr("src")), nationalRank: cells.eq(3).text().trim() || null, zoneRank: cells.eq(4).text().trim() || null}];
  });
  if (!players.length) throw new Error("SNP no devolvió una plantilla reconocible. Se conserva la última consulta.");
  const heading = $("h3").toArray().map(el=>$(el).text().trim()).find(text=>/^Jugadores de /i.test(text))?.replace(/^Jugadores de /i,"") || $("h4,h3,h2,h1").toArray().map(el => $(el).text().trim()).find(text => text && !/^(Equipos|Plantilla|Jugadores|Ranking)/i.test(text));
  return {id, name: heading?.replace(/^Equipo\s*:?\s*/i, "") || `Equipo SNP ${id}`, players};
}
type Row = Record<string, unknown>;
export function parsePlayerIdentity(html:string){
  const q=load(html);
  for(const element of q("script:not([src])").toArray()){
    const match=q(element).text().match(/\bjugador\s*=\s*(\{[\s\S]*?\})\s*;/);
    if(!match)continue;
    try {const row=JSON.parse(match[1]) as Row;return {name:[row.nombre,row.apellidos].filter(Boolean).join(" ").replace(/\s+/g," ").trim(),photoUrl:row.imagen_jugador&&/^\d+$/.test(String(row.idusuario))?photoUrl(`https://snpgalaxy.com/public/files/usuario/${row.idusuario}/${row.imagen_jugador}`):null};}catch{/* Parse literal JSON only; never execute SNP scripts. */}
  }
  return {name:"",photoUrl:null};
}
export function normalizePlayerStats(value: unknown): SnpPlayerStats[] {
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap((phase: Row) => {
    if (!phase || typeof phase.J !== "object" || !phase.J) return [];
    const jornadas = Object.entries(phase.J as Record<string,Row>).filter(([,row])=>row && typeof row === "object").sort(([a],[b])=>snpNumber(a)-snpNumber(b)).map(([round,row])=>{
      const won=["p3p_g2s","p3p_g3s","p2p_g2s","p2p_g3s"].reduce((n,k)=>n+snpNumber(row[k]),0);
      const lost=["p3p_p2s","p3p_p3s","p2p_p2s","p2p_p3s"].reduce((n,k)=>n+snpNumber(row[k]),0);
      return {label:round === "retos" || round === "1000" ? "Retos" : `J${round}`,points:row.puntos == null?null:snpNumber(row.puntos),played:snpNumber(row.pd),won,lost,setsWon:snpNumber(row.sg),setsLost:snpNumber(row.sp)};
    });
    const sum=(key:"played"|"won"|"lost"|"setsWon"|"setsLost")=>jornadas.reduce((n,j)=>n+j[key],0);
    return [{phase:String(phase.nombre || phase.div || "Fase SNP"),played:sum("played"),won:sum("won"),lost:sum("lost"),setsWon:sum("setsWon"),setsLost:sum("setsLost"),jornadas:jornadas.map(({label,points,played,won,lost})=>({label,points,played,won,lost}))}];
  });
}
export function normalizeStandings(rows: unknown): SnpStanding[] {
  if (!Array.isArray(rows) || !rows.length) throw new Error("SNP no devolvió la clasificación esperada.");
  return rows.map((row: Row) => ({teamId: String(row.idequipo ?? ""), name: String(row.nombre ?? ""), won: snpNumber(row.ganados), lost: snpNumber(row.perdidos), played: snpNumber(row.ganados) + snpNumber(row.perdidos) + snpNumber(row.anulados), points: snpNumber(row.puntos), gameDifference: snpNumber(row.diferenciajuegos)})).filter(r => /^\d+$/.test(r.teamId) && r.name);
}
export function normalizeFixtures(rows: unknown): SnpFixture[] {
  if (!Array.isArray(rows)) throw new Error("SNP no devolvió un calendario reconocible.");
  return rows.flatMap((row: Row) => {
    const home = row.Equipo1 as Row | undefined; const away = row.Equipo2 as Row | undefined;
    if (!home || !away) return [];
    const rawScore = String(row.resultado ?? "");
    const numbers = rawScore.match(/\d+/g)?.map(Number);
    const score: [number,number] | null = numbers?.length === 2 ? [numbers[0],numbers[1]] : null;
    if(!/^\d+$/.test(String(row.id)))return [];
    return [{id: String(row.id), round: snpNumber(row.ronda), date: snpDate(row.fecha), homeId: String(row.idequipo1 ?? home.id), awayId: String(row.idequipo2 ?? away.id), homeName: String(home.nombre), awayName: String(away.nombre), score, state: String(row.estado ?? "")}];
  });
}
export function parseMatch(html: string, id: string): SnpMatch {
  const $ = load(html); const title = $("h4").first().text().trim(); const dateLabel = $("h2").first().text().replace(/\s+/g," ").trim();
  if (!title.includes("Enfrentamiento")) throw new Error("SNP no devolvió un acta reconocible.");
  const teamLinks = $(".partido_equipo_nombre_new").toArray().map(a => $(a).text().replace(/\s+/g," ").trim()).filter(Boolean);
  const scoreNumbers = dateLabel.match(/^(\d+)\s*-\s*(\d+)/);
  // Result tables contain the L/V rows. Player names are read from the same card, never from private profile fields.
  const games = $(".table_partidos table").toArray().flatMap((table) => {
    const rows = $(table).find("tbody tr");
    if (rows.length !== 2 || !/^L/.test(rows.eq(0).text().trim())) return [];
    const local = rows.eq(0).find("td").toArray().map(td => $(td).text().trim());
    const away = rows.eq(1).find("td").toArray().map(td => $(td).text().trim());
    const sets: [number,number][] = [];
    for (let set=1;set<=3;set++) {
      const home=$(table).find(`.td_part_res[set='${set}'][eq='1']`).text().trim();
      const away=$(table).find(`.td_part_res[set='${set}'][eq='2']`).text().trim();
      if (/^\d+$/.test(home) && /^\d+$/.test(away)) sets.push([Number(home),Number(away)]);
    }
    if (!$(table).find(".td_part_res").length) for(let col = Math.max(1, local.length - 3); col < local.length; col++) if (/^\d+$/.test(local[col]) && /^\d+$/.test(away[col])) sets.push([Number(local[col]),Number(away[col])]);
    const container = $(table).closest(".enf_partido_container");
    const card = container.length ? container : $(table).closest(".table_partidos");
    const people = card.find(".partido_jug_div[idjugador]").toArray().map(a => ({id:$(a).attr("idjugador")||"",name:$(a).text().replace(/\s+/g," ").trim().replace(/\s*-\s*\d+(?:[.,]\d+)?$/, ""),photoUrl:photoUrl($(a).find("img").attr("src"))})).filter(p=>p.name);
    return [{index:0,id:card.find("[idpartido]").first().attr("idpartido"),homePlayers:people.slice(0,2).map(p=>p.name),awayPlayers:people.slice(2,4).map(p=>p.name),home:people.slice(0,2),away:people.slice(2,4),sets}];
  });
  games.forEach((game,index)=>{game.index=index;});
  const teamIds: [string,string] = [$(".partido_equipo_nombre_new[equipo='1']").attr("idequipo1")||"",$(".partido_equipo_nombre_new[equipo='2']").attr("idequipo2")||""];
  return {id,title,dateLabel,teamIds,teams: [teamLinks[0] ?? "Local", teamLinks[1] ?? "Visitante"], score: scoreNumbers ? [Number(scoreNumbers[1]),Number(scoreNumbers[2])] : null, games};
}

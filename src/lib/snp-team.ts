import { load } from "cheerio";
import type { SnpTeam,SnpPlayer } from "@/domain/snp";
import { snpClient } from "./snp-client";
import { photoUrl,snpNumber } from "./snp-parser";
type Row=Record<string,unknown>;
export function normalizeTeamPlayer(row:Row):SnpPlayer {
  const memberships=Array.isArray(row.EquipoJugador)?row.EquipoJugador as Row[]:[];
  const team=memberships[0]?.Equipo as Row|undefined;
  const entries=team?.FaseclubcatEquipo as Row[]|undefined;
  const category=((entries?.[0]?.Faseclubcat as Row|undefined)?.Categoria as Row|undefined)?.id;
  const ranks=Array.isArray(row.Ranking)?row.Ranking as Row[]:[];
  const matching=ranks.filter(r=>String(r.idcategoria)===String(category));
  const national=matching.find(r=>!r.idzona);const zonal=matching.find(r=>r.idzona);
  return {id:String(row.id),name:[row.nombre,row.apellidos].filter(Boolean).join(" ").replace(/\s+/g," ").trim(),points:snpNumber(national?.puntos),nationalRank:national?.orden?String(national.orden):null,zoneRank:zonal?.orden?String(zonal.orden):null,photoUrl:row.imagen_jugador&&/^\d+$/.test(String(row.idusuario))?photoUrl(`https://snpgalaxy.com/public/files/usuario/${row.idusuario}/${row.imagen_jugador}`):null};
}
export async function fetchSnpTeam(id:string):Promise<SnpTeam>{
  const html=await snpClient.html(`/equipo/view/${id}`);const q=load(html);
  const heading=q("h3").toArray().map(e=>q(e).text().trim()).find(t=>/^Jugadores de /i.test(t));
  if(!heading)throw new Error("SNP no devolvió la ficha del equipo solicitado.");
  const players:SnpPlayer[]=[];let expected:number|undefined;
  for(let page=1;page<=25;page++){
    const result=await snpClient.ajax("ajaxGetAllJugadores",{filtro:"",num_pagina:String(page),limite_pagina:"20",update:"1",idequipo:id,desde_clasificacion_final:"0"},"jugador");
    if(!Array.isArray(result.entities))throw new Error("SNP ha cambiado el formato de las plantillas.");
    if(page===1&&result.num_resultados!=null)expected=snpNumber(result.num_resultados);
    const rows=result.entities as Row[];
    for(const row of rows){const player=normalizeTeamPlayer(row);if(/^\d+$/.test(player.id)&&player.name&&!players.some(p=>p.id===player.id))players.push(player);}
    if(rows.length<20||(expected!==undefined&&players.length>=expected))return {id,name:heading.replace(/^Jugadores de /i,"").replace(/\s+/g," ").trim(),players};
  }
  throw new Error("La plantilla de SNP supera el límite de consulta. Se conserva la última consulta completa.");
}

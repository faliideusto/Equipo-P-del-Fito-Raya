import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFixtures,normalizeStandings,normalizePlayerStats,photoUrl,snpNumber,parseMatch } from "../src/lib/snp-parser";
import { normalizeTeamPlayer } from "../src/lib/snp-team";
import { createSnpHttp } from "../src/lib/snp-auth";
import { snpDate } from "../src/lib/snp-date";
import { CookieJar } from "tough-cookie";

test("normaliza fechas españolas independientemente de la zona del servidor",()=>{
  assert.equal(snpDate("2026-09-26 13:00:00"),"2026-09-26T11:00:00.000Z");
  assert.equal(snpDate("2027-01-16 13:00:00"),"2027-01-16T12:00:00.000Z");
  assert.equal(snpDate("2026-09-26"),"2026-09-26");
  assert.equal(snpDate(null),null);assert.equal(snpDate("no publicado"),null);
});
test("conserva el orden SNP y su victoria publicada en un empate a seis",()=>{
  const rows=normalizeStandings([{idequipo:7778,nombre:"Fito A",puntos:6,ganados:1,perdidos:0,anulados:0},{idequipo:2598,nombre:"Vibra",puntos:6,ganados:0,perdidos:1,anulados:0}]);
  assert.deepEqual(rows.map(r=>r.teamId),["7778","2598"]);assert.equal(rows[0].won,1);
});
test("distingue resultado de estado G y mantiene los IDs local y visitante",()=>{
  const rows=normalizeFixtures([{id:55252,ronda:1,estado:"G",resultado:"6;6",fecha:"2026-09-26 13:00:00",Equipo1:{id:7778,nombre:"Fito"},Equipo2:{id:2598,nombre:"Vibra"}},{id:55262,ronda:2,estado:"G",resultado:null,Equipo1:{id:3349,nombre:"Arcos"},Equipo2:{id:7778,nombre:"Fito"}}]);
  assert.deepEqual(rows[0].score,[6,6]);assert.equal(rows[1].score,null);assert.equal(rows[1].awayId,"7778");
});
test("solo conserva datos deportivos del jugador, sin contactos ni identidad privada",()=>{
  const player=normalizeTeamPlayer({id:123,nombre:"Ana",apellidos:"Pérez",email:"private",movil:"private",dni:"private",idusuario:100,imagen_jugador:"foto.jpg",EquipoJugador:[{Equipo:{FaseclubcatEquipo:[{Faseclubcat:{Categoria:{id:20}}}]}}],Ranking:[{idcategoria:20,idzona:null,puntos:2500,orden:7},{idcategoria:20,idzona:128,orden:2},{idcategoria:19,idzona:null,puntos:50000}]});
  assert.equal(player.points,2500);assert.equal(player.nationalRank,"7");assert.equal(player.zoneRank,"2");
  assert.deepEqual(Object.keys(player).sort(),["id","name","points","nationalRank","zoneRank","photoUrl"].sort());
  assert.equal(normalizeTeamPlayer({id:1,nombre:"Sin ranking"}).points,0);
  assert.equal(snpNumber("66.383,93 / Future"),66383.93);
  assert.equal(photoUrl("https://example.com/photo.jpg"),null);assert.equal(photoUrl("javascript:alert(1)"),null);
});
test("historial ordenado y contadores booleanos de SNP",()=>{
  const stats=normalizePlayerStats({fase:{nombre:"Regular",J:{2:{pd:false,puntos:100},1:{pd:true,p3p_g2s:1,sg:2,sp:0,puntos:2500}}}});
  assert.equal(stats[0].played,1);assert.equal(stats[0].won,1);assert.deepEqual(stats[0].jornadas.map(j=>j.label),["J1","J2"]);
});
test("lee acta L/V con set parcial y conserva IDs de jugadores",()=>{
  const html=`<h4>Enfrentamiento (#55252)</h4><h2>6 - 6</h2><div class="partido_equipo_nombre_new" equipo="1" idequipo1="7778">Fito A</div><div class="partido_equipo_nombre_new" equipo="2" idequipo2="2598">Vibra</div><div class="enf_partido_container"><div class="partido_jug_div" idjugador="368641" idpartido="270263">Daniel - 57229.17</div><div class="partido_jug_div" idjugador="376502">José Luis - 67924.11</div><div class="partido_jug_div" idjugador="317854">Ignacio - 58645.83</div><div class="partido_jug_div" idjugador="317859">Manuel - 52232.14</div><div class="table_partidos"><table><tbody><tr><td>L</td><td class="td_part_res" set="1" eq="1">6</td><td class="td_part_res" set="2" eq="1"></td></tr><tr><td>V</td><td class="td_part_res" set="1" eq="2">2</td><td class="td_part_res" set="2" eq="2"></td></tr></tbody></table></div></div>`;
  const match=parseMatch(html,"55252");assert.deepEqual(match.teamIds,["7778","2598"]);assert.equal(match.games[0].home?.[0].id,"368641");assert.equal(match.games[0].id,"270263");assert.deepEqual(match.games[0].sets,[[6,2]]);assert.deepEqual(match.games[0].homePlayers,["Daniel","José Luis"]);
});
test("no reenvía credenciales a un redirect de Google ni a otro dominio",async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(null,{status:307,headers:{location:"https://accounts.google.com/"}});};
  try {await assert.rejects(()=>createSnpHttp(new CookieJar())("https://snpgalaxy.com/usuario/login",{method:"POST",body:"secret"}));assert.equal(calls,1);}
  finally{globalThis.fetch=original;}
});

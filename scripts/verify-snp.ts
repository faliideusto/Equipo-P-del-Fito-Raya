import {getSnpTeam,getSnpCompetition,getSnpPlayer,getSnpMatch} from '../src/lib/snp-service';
async function verify(){
process.loadEnvFile('.env.local');
for(const id of ['7778','803902']){const r=await getSnpTeam(id,true);console.log(JSON.stringify({kind:'team',id,source:r.source,stale:r.stale,error:r.error,players:r.data.players.length,name:r.data.name}));}
for(const division of ['2318','2326']){const r=await getSnpCompetition({division},true);console.log(JSON.stringify({kind:'competition',division,source:r.source,stale:r.stale,error:r.error,filters:r.data.filters,teams:r.data.standings.length,rounds:r.data.rounds.length,calendar:r.data.calendar.length,results:r.data.fixtures.length}));}
for(const [id,team] of [['376502','7778'],['381480','803902']]){const r=await getSnpPlayer(id,team,undefined,true);console.log(JSON.stringify({kind:'player',id,source:r.source,stale:r.stale,error:r.error,name:r.data.name,points:r.data.points,groups:r.data.groups,stats:r.data.stats.map(s=>({phase:s.phase,played:s.played,won:s.won,lost:s.lost,rounds:s.jornadas.length})),previousPhases:r.data.previousStats.length}));}
const match=await getSnpMatch('55252',true);console.log(JSON.stringify({kind:'match',source:match.source,stale:match.stale,error:match.error,teams:match.data.teams,games:match.data.games.map(g=>({number:g.index+1,sets:g.sets,home:g.homePlayers,away:g.awayPlayers}))}));
}
verify().catch(()=>{console.error("No se pudo completar la verificación SNP.");process.exitCode=1;});

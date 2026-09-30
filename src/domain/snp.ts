export interface SnpOption { id: string; name: string }
export interface SnpPlayer { id: string; name: string; points: number; photoUrl: string | null; nationalRank: string | null; zoneRank: string | null }
export interface SnpPlayerStats { phase: string; played: number; won: number; lost: number; setsWon: number; setsLost: number; jornadas: {label:string; points:number|null; played:number; won:number; lost:number}[] }
export interface SnpPlayerProfile extends SnpPlayer { groups:SnpOption[]; group:string; stats:SnpPlayerStats[]; previousStats:SnpPlayerStats[]; statsError?:string }
export interface SnpTeam { id: string; name: string; players: SnpPlayer[] }
export interface SnpStanding { teamId: string; name: string; played: number; won: number; lost: number; points: number; gameDifference: number }
export interface SnpFixture { id: string; round: number; date: string | null; homeId: string; awayId: string; homeName: string; awayName: string; score: [number, number] | null; state: string }
export interface SnpCompetition {
  filters: { zone: string; phase: string; category: string; group: string; club?:string; division: string; round: string };
  clubs?:SnpOption[];
  zones: SnpOption[]; phases: SnpOption[]; categories: SnpOption[]; groups: SnpOption[]; divisions: SnpOption[]; rounds: SnpOption[];
  standings: SnpStanding[]; fixtures: SnpFixture[]; calendar: SnpFixture[];
}
export interface SnpMatchPlayer { id: string; name: string; photoUrl: string | null }
export interface SnpMatch { id: string; title: string; dateLabel: string; teams: [string,string]; teamIds?: [string,string]; score: [number,number] | null; games: { index: number; id?: string; homePlayers: string[]; awayPlayers: string[]; home?: SnpMatchPlayer[]; away?: SnpMatchPlayer[]; sets: [number,number][] }[] }
export interface SnpResult<T> { data: T; updatedAt: string; source: "live" | "cache" | "snapshot"; stale: boolean; error?: string }

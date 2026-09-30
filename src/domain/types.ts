export type TeamId = "a" | "b";
export type Position = "RIGHT" | "LEFT" | "BOTH";
export interface Player {
  id: string;
  name: string;
  teamId: TeamId;
  sourceId?: string;
  photoUrl?: string | null;
  points: number | null;
  position: Position | null;
}
export interface Team {
  id: TeamId;
  name: string;
  division: string;
  shortName: string;
}
export interface Standing {
  teamId?: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  own?: boolean;
}
export type Pair = { id: string; players: [string | null, string | null] };
export interface Match {
  pairIndex: number;
  playerIds: [string, string];
  opponents: [string, string];
  winner: "home" | "away";
  sets?: [number, number][];
}
export interface Fixture {
  id: string;
  teamId: TeamId;
  round: number;
  opponent: string;
  date: string;
  venue: string;
  home: boolean;
  status: "pending" | "played";
  matches: Match[];
  score?: [number, number] | null;
}

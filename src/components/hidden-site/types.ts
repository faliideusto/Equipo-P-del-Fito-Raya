// A player of either side, in the shape the hidden site needs.
export type LineupPlayer = {
  id: string;
  name: string;
  points: number | null;
  photo: string | null;
  // SNP player and team ids to read the winrate; club members without SNP have none.
  snpId?: string;
  snpTeam?: string;
};

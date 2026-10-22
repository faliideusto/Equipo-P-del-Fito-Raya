"use client";
import { useEffect, useState } from "react";
import type { PlayerWinRate } from "@/domain/player-winrate";
import type { LineupPlayer } from "./types";

export type PlayerStats = { rate?: PlayerWinRate; failed?: boolean };
// Shared by every view of the page: each player is read from SNP once, a few at a time.
const known = new Map<string, Promise<PlayerStats>>();
const queue: (() => void)[] = []; let running = 0;
function limited<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = () => { running++; task().then(resolve, reject).finally(() => { running--; queue.shift()?.(); }); };
    if (running < 4) start(); else queue.push(start);
  });
}
function load(player: LineupPlayer): Promise<PlayerStats> {
  const key = `${player.snpId}-${player.snpTeam ?? ""}`;
  let value = known.get(key);
  if (!value) {
    value = limited(async () => {
      const response = await fetch(`/api/snp/players/${player.snpId}${player.snpTeam ? `?team=${player.snpTeam}` : ""}`);
      if (!response.ok) return { failed: true };
      const result = await response.json();
      return result.data?.winRates ? { rate: result.data.winRates.total } : { failed: true };
    }).catch(() => ({ failed: true }));
    known.set(key, value);
  }
  return value;
}
export function usePlayerStats(players: LineupPlayer[]) {
  const [stats, setStats] = useState<Record<string, PlayerStats>>({});
  const wanted = players.filter(player => player.snpId).map(player => `${player.id}|${player.snpId}|${player.snpTeam ?? ""}`).join(",");
  useEffect(() => {
    let active = true;
    for (const entry of wanted ? wanted.split(",") : []) {
      const [id, snpId, snpTeam] = entry.split("|");
      void load({ id, name: "", points: null, photo: null, snpId, snpTeam: snpTeam || undefined }).then(value => { if (active) setStats(current => current[id] === value ? current : { ...current, [id]: value }); });
    }
    return () => { active = false; };
  }, [wanted]);
  return stats;
}

import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { cacheFolder } from "./snp-cache";
import type { SnpPlayerProfile } from "@/domain/snp";

type WinRates = NonNullable<SnpPlayerProfile["winRates"]>;
export type StoredWinRates = { fingerprint: string; winRates: WinRates; savedAt: string };

// Safety net for matches in another group, which do not change the selected group's data.
export const WINRATE_MAX_AGE = 24 * 3600 * 1000;

// The winrate needs one SNP request per group, so it is only recalculated when the player's
// ranking data (groups, points and match counts of the selected group) changes.
export function winRateFingerprint(profile: Pick<SnpPlayerProfile, "groups" | "group" | "points" | "stats" | "previousStats">) {
  const data = { groups: profile.groups.map(g => g.id), group: profile.group, points: profile.points, stats: profile.stats, previous: profile.previousStats };
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

export function reusableWinRates(stored: StoredWinRates | undefined, fingerprint: string, now = Date.now()) {
  if (!stored || stored.fingerprint !== fingerprint) return undefined;
  return now - Date.parse(stored.savedAt) < WINRATE_MAX_AGE ? stored.winRates : undefined;
}

const file = (key: string) => path.join(cacheFolder(), `winrates-${key}.json`);

export async function readWinRates(key: string): Promise<StoredWinRates | undefined> {
  try { return JSON.parse(await readFile(file(key), "utf8")); } catch { return undefined; }
}

export async function saveWinRates(key: string, fingerprint: string, winRates: WinRates) {
  const target = file(key); const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(temporary, JSON.stringify({ fingerprint, winRates, savedAt: new Date().toISOString() }), { mode: 0o600 });
    await rename(temporary, target);
  } catch { /* Without a stored copy the winrate is simply recalculated next time. */ }
}

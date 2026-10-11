// Forced SNP reads come from user buttons: limit them per key so nobody can flood SNP.
// Blocked calls do not extend the window; they simply get the cached data.
export const FORCED_REFRESH_MS = 30 * 1000;
const lastForced = new Map<string, number>();
export function allowForcedRefresh(key: string, now = Date.now()) {
  const last = lastForced.get(key);
  if (last !== undefined && now - last < FORCED_REFRESH_MS) return false;
  if (lastForced.size > 500) lastForced.clear();
  lastForced.set(key, now);
  return true;
}

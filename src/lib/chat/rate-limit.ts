// In-process limit: the club PC answers one question at a time, so a few people asking a lot would block everyone.
export const CHAT_LIMIT = 20;
const WINDOW = 3600000;
const hits = new Map<string, number[]>();
export function allowChat(userId: string, now = Date.now()) {
  if (hits.size > 5000) for (const [id, times] of hits) if (times.every(t => now - t >= WINDOW)) hits.delete(id);
  const recent = (hits.get(userId) ?? []).filter(t => now - t < WINDOW);
  const allowed = recent.length < CHAT_LIMIT;
  if (allowed) recent.push(now);
  hits.set(userId, recent);
  return allowed;
}

// The chat lives only in this tab. On mount the persist effect runs before the saved chat is restored,
// so saving is ignored until load() has read what was there.
type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
const KEY = "fito-asistente";
export function historyStore<T>(storage: () => Storage) {
  let loaded = false;
  return {
    load(): T[] {
      loaded = true;
      try { const saved = JSON.parse(storage().getItem(KEY) ?? "[]"); return Array.isArray(saved) ? saved : []; } catch { return []; }
    },
    save(messages: T[]) {
      if (!loaded) return;
      try { storage().setItem(KEY, JSON.stringify(messages)); } catch { /* private mode: the chat is not kept */ }
    },
  };
}
// The team selector: what the viewer picked in this tab, or the default for them ("ambos" = null).
const TEAM_KEY = "fito-asistente-equipo";
export function teamChoice(storage: () => Storage) {
  return {
    load(fallback: "a" | "b" | null): "a" | "b" | null {
      try { const saved = storage().getItem(TEAM_KEY); return saved === "a" || saved === "b" ? saved : saved === "ambos" ? null : fallback; } catch { return fallback; }
    },
    save(team: "a" | "b" | null) {
      try { storage().setItem(TEAM_KEY, team ?? "ambos"); } catch { /* private mode: the default is used next time */ }
    },
  };
}

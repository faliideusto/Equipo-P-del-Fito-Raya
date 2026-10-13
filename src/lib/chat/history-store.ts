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

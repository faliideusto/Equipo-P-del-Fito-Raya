import test from "node:test";
import assert from "node:assert/strict";
import { historyStore } from "../src/lib/chat/history-store";

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; }, data };
};

test("guardar antes de restaurar no borra la conversación guardada (orden de efectos al montar)", () => {
  const storage = memory({ "fito-asistente": JSON.stringify([{ role: "user", content: "hola" }]) });
  const store = historyStore(() => storage);
  store.save([]); // the persist effect runs first with the initial empty state
  assert.deepEqual(store.load(), [{ role: "user", content: "hola" }]);
  store.save([{ role: "user", content: "otra" }]);
  assert.deepEqual(JSON.parse(storage.data["fito-asistente"]), [{ role: "user", content: "otra" }]);
});

test("sin almacenamiento o con datos rotos se empieza vacío", () => {
  assert.deepEqual(historyStore(() => { throw new Error("private mode"); }).load(), []);
  assert.deepEqual(historyStore(() => memory({ "fito-asistente": "{roto" })).load(), []);
  assert.deepEqual(historyStore(() => memory({ "fito-asistente": "{}" })).load(), []);
});

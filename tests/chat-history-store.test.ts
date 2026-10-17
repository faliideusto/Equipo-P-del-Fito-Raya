import test from "node:test";
import assert from "node:assert/strict";
import { historyStore, teamChoice } from "../src/lib/chat/history-store";

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

test("el equipo elegido se recuerda en la pestaña; sin elección, manda el valor por defecto", () => {
  const storage = memory();
  const choice = teamChoice(() => storage);
  assert.equal(choice.load("b"), "b");
  choice.save(null);
  assert.equal(choice.load("b"), null, "Ambos guardado gana al defecto");
  choice.save("a");
  assert.equal(choice.load(null), "a");
  assert.equal(teamChoice(() => memory({ "fito-asistente-equipo": "zzz" })).load("a"), "a");
  assert.equal(teamChoice(() => { throw new Error("private mode"); }).load("b"), "b");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildLineupMessage, cleanNickname, shortPlayerName, withNickname } from "../src/domain/team-result-message";
import { buildWalletCard, type TeamCardContext } from "../src/domain/wallet-card";
import { readNicknames, saveNicknames } from "../src/lib/player-nicknames";

test("el mote va entre paréntesis en convocatorias y rankings, y solo en Wallet", () => {
  assert.equal(withNickname("Carlos Martin", "Charly"), "Carlos Martin (Charly)");
  assert.equal(withNickname("Carlos Martin", null), "Carlos Martin");
  assert.equal(shortPlayerName("CARLOS MARTIN", "Charly"), "Charly");
  assert.equal(shortPlayerName("CARLOS MARTIN", null), "Carlos Martin");
});
test("valida y limpia el mote", () => {
  assert.equal(cleanNickname("  El   Rubio "), "El Rubio");
  assert.equal(cleanNickname(""), null);
  assert.equal(cleanNickname(null), null);
  assert.equal(cleanNickname("x".repeat(21)), undefined);
  assert.equal(cleanNickname("(Rubio)"), undefined);
  assert.equal(cleanNickname(7), undefined);
});
test("la convocatoria de WhatsApp muestra el mote", () => {
  const text = buildLineupMessage({ round: 5, teamId: "a", opponent: "Rival", home: true, date: "", players: [{ id: "a-1", name: "CARLOS MARTIN", nickname: "Charly" }, { id: "a-2", name: "juan perez" }], pairs: [{ id: "s0", players: ["a-1", "a-2"] }] });
  assert.match(text, /\nCarlos Martin \(Charly\) \/ Juan Perez\n/);
});
test("la tarjeta de Wallet usa el mote del jugador y de su pareja", () => {
  const ctx: TeamCardContext = {
    teamId: "a", next: { id: "50", round: 5, opponent: "Rival", date: "", home: true }, last: null,
    players: [{ id: "a-1", sourceId: "1", name: "CARLOS MARTIN", nickname: "Charly", position: "LEFT", points: 100 }, { id: "a-2", sourceId: "2", name: "juan perez", nickname: "Juanito", position: null, points: null }],
    published: { fixtureId: "50", pairs: [{ id: "p1", players: ["a-1", "a-2"] }] },
  };
  const card = buildWalletCard(ctx, "1")!;
  assert.equal(card.playerName, "Charly");
  assert.equal(card.playerLine, "Charly · Revés");
  assert.equal(card.lineupShort, "Pareja 1 con Juanito");
});
test("conserva y borra motes en el archivo privado", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fito-nicknames-"));
  const previous = process.env.PLAYER_NICKNAMES_FILE;
  process.env.PLAYER_NICKNAMES_FILE = path.join(directory, "nicknames.json");
  try {
    assert.deepEqual(await readNicknames(), {});
    await Promise.all([saveNicknames({ "1": "Charly" }), saveNicknames({ "2": "Juanito" })]);
    assert.deepEqual(await readNicknames(), { "1": "Charly", "2": "Juanito" });
    await saveNicknames({ "1": null });
    assert.deepEqual(await readNicknames(), { "1": null, "2": "Juanito" });
  } finally {
    if (previous === undefined) delete process.env.PLAYER_NICKNAMES_FILE;
    else process.env.PLAYER_NICKNAMES_FILE = previous;
    await rm(directory, { recursive: true });
  }
});
test("la API de motes rechaza otro origen, cuerpos grandes y datos no válidos antes de leer la sesión", async () => {
  const { POST } = await import("../src/app/api/nicknames/route");
  const request = (origin: string, body: string) => new Request("http://localhost/api/nicknames", { method: "POST", headers: { origin, host: "localhost", "Content-Type": "application/json" }, body });
  assert.equal((await POST(request("http://example.com", JSON.stringify({ teamId: "a", nicknames: [] })))).status, 403);
  assert.equal((await POST(request("http://localhost", "x".repeat(17000)))).status, 413);
  assert.equal((await POST(request("http://localhost", JSON.stringify({ teamId: "c", nicknames: [] })))).status, 400);
  assert.equal((await POST(request("http://localhost", "{"))).status, 400);
});

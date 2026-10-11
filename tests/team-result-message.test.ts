import test from "node:test";
import assert from "node:assert/strict";
import { buildTeamResultMessage, displayName, teamResultPairs, whatsappShareUrl, type TeamResultPair } from "../src/domain/team-result-message";
import type { SnpMatch } from "../src/domain/snp";
import type { SetScore } from "../src/domain/match-result";

const p = (id: string) => ({ id, name: `Jugador ${id}`, photoUrl: null });
const acta = (games: { home: string[]; away: string[]; sets?: SetScore[] }[]): SnpMatch => ({ id: "1", title: "", dateLabel: "", teams: ["Fito A", "Arcos"], teamIds: ["7778", "3349"], score: null, games: games.map((g, index) => ({ index, homePlayers: g.home.map(id => `Jugador ${id}`), awayPlayers: g.away.map(id => `Jugador ${id}`), home: g.home.map(p), away: g.away.map(p), sets: g.sets ?? [] })) });
const win: SetScore[] = [[6, 3], [6, 4]]; const loss: SetScore[] = [[4, 6], [6, 7]];
const pair = (index: number, sets: SetScore[], names = [`A${index}`, `B${index}`]): TeamResultPair => ({ index, sets, names });

test("sin las cinco parejas no hay mensaje", () => {
  assert.equal(teamResultPairs({ appResults: { 1: win, 2: win, 3: win, 4: win }, acta: null, ownSide: 0, submitterNames: {} }), null);
});
test("combina app y SNP; la app manda y los sets SNP se giran si somos visitantes", () => {
  const match = acta([1, 2, 3, 4, 5].map(i => ({ home: [`r${i}`, `s${i}`], away: [`${i}0`, `${i}1`], sets: i === 5 ? [[3, 6], [4, 6]] : [] })));
  const pairs = teamResultPairs({ appResults: { 1: win, 2: loss, 3: win, 4: loss }, acta: match, ownSide: 1, submitterNames: {} })!;
  assert.deepEqual(pairs[4].sets, [[6, 3], [6, 4]]);
  assert.deepEqual(pairs[0].names, ["Jugador 10", "Jugador 11"]);
  const appWins = teamResultPairs({ appResults: { 1: win, 2: win, 3: win, 4: win, 5: loss }, acta: match, ownSide: 1, submitterNames: {} })!;
  assert.deepEqual(appWins[4].sets, loss);
});
test("sin convocatoria usa el nombre de quien envió el resultado", () => {
  const pairs = teamResultPairs({ appResults: { 1: win, 2: win, 3: win, 4: win, 5: win }, acta: null, ownSide: 0, submitterNames: { 2: "Dani Ruiz" } })!;
  assert.deepEqual(pairs[1].names, ["Dani Ruiz"]);
  assert.deepEqual(pairs[0].names, []);
});
test("plantilla completa con victoria, tercer set y súper tie-break", () => {
  const text = buildTeamResultMessage({ round: 4, teamId: "a", opponent: "C.D. VibraPadel", home: true, date: "2026-10-18T15:00:00.000Z", pairs: [pair(1, win), pair(2, loss), pair(3, [[6, 4], [3, 6], [10, 8]]), pair(4, loss), pair(5, win, [])] });
  assert.equal(text, [
    "🎾 *Jornada 4 · Fito Raya A*", "🆚 C.D. VibraPadel · 🏠 Local", "📅 Dom 18/10 · 17:00", "",
    "🏆 *¡VICTORIA 7–5!*", "",
    "*Pareja 1* (3 pts) ✅", "A1 / B1", "6-3 · 6-4", "",
    "*Pareja 2* (3 pts) ❌", "A2 / B2", "4-6 · 6-7", "",
    "*Pareja 3* (2 pts) ✅", "A3 / B3", "6-4 · 3-6 · 10-8", "",
    "*Pareja 4* (2 pts) ❌", "A4 / B4", "4-6 · 6-7", "",
    "*Pareja 5* (2 pts) ✅", "6-3 · 6-4", "",
    "💪 ¡Vamos Fito Raya!",
  ].join("\n"));
});
test("derrota de visitante con fecha sin hora", () => {
  const text = buildTeamResultMessage({ round: 2, teamId: "b", opponent: "Arcos", home: false, date: "2026-10-18", pairs: [pair(1, loss), pair(2, loss), pair(3, win), pair(4, win), pair(5, loss)] });
  assert.match(text, /^🎾 \*Jornada 2 · Fito Raya B\*\n🆚 Arcos · ✈️ Visitante\n📅 Dom 18\/10\n\n/);
  assert.match(text, /😔 \*DERROTA 4–8\*/);
});
test("empate 6–6 y fecha vacía sin línea de fecha", () => {
  const text = buildTeamResultMessage({ round: 1, teamId: "a", opponent: "X", home: true, date: "", pairs: [pair(1, win), pair(2, win), pair(3, loss), pair(4, loss), pair(5, loss)] });
  assert.match(text, /🤝 \*EMPATE 6–6\*/);
  assert.ok(!text.includes("📅"));
});
test("enlace de WhatsApp codificado", () => {
  assert.equal(whatsappShareUrl("¡Hola *equipo*!\n6-3 🎾✅"), "https://api.whatsapp.com/send?text=%C2%A1Hola%20*equipo*!%0A6-3%20%F0%9F%8E%BE%E2%9C%85");
});
test("los nombres se escriben con mayúscula inicial", () => {
  assert.equal(displayName("DANIEL H CAMPOS SÁNCHEZ"), "Daniel H Campos Sánchez");
  assert.equal(displayName("hugo monroux"), "Hugo Monroux");
  assert.equal(displayName("JOSÉ MARÍA DE LA TORRE-GARCÍA"), "José María de la Torre-García");
  assert.equal(displayName("  DEL  RIO "), "Del Rio");
  const pairs = teamResultPairs({ appResults: { 1: win, 2: win, 3: win, 4: win, 5: win }, acta: null, ownSide: 0, submitterNames: { 1: "ÁNGEL AFAN" } })!;
  assert.deepEqual(pairs[0].names, ["Ángel Afan"]);
});

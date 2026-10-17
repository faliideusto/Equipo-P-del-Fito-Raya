import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ActaGameRows, type ActaProvisional } from "../src/components/acta-game-rows";
import type { SetScore } from "../src/domain/match-result";

const router: AppRouterInstance = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, bfcacheId: "test" };
const provisional: ActaProvisional = { fixtureId: "55", teamId: "a", ownSide: 1, sets: null, editable: true };
const render = (pending = provisional, sets: SetScore[] = []) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement("table", null, createElement(ActaGameRows, { game: { index: 1, homePlayers: [], awayPlayers: [], sets }, teams: ["Rival", "FITO RAYA"], provisional: pending }))));

test("la pareja vacía muestra Añadir resultado si el capitán tiene permiso", () => {
  const html = render();
  assert.match(html, />Añadir resultado<\/button>/);
  assert.match(html, /rowSpan="3"/i);
  assert.doesNotMatch(render({ ...provisional, editable: false }), /<button/);
});

test("un resultado guardado muestra Modificar y uno publicado por SNP oculta las acciones", () => {
  const pending = { ...provisional, sets: [[2, 6], [5, 7]] as SetScore[] };
  assert.match(render(pending), />Modificar<\/button>/);
  assert.doesNotMatch(render(pending, [[6, 2], [7, 5]]), /<button/);
});

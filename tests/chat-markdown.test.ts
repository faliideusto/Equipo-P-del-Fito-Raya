import test from "node:test";
import assert from "node:assert/strict";
import { parseMarkdown } from "../src/lib/chat/markdown";

test("párrafos, negrita y listas con - o *", () => {
  assert.deepEqual(parseMarkdown("Hola **Ana**.\n\n- uno\n* **dos**\nfin"), [
    { type: "p", parts: [{ text: "Hola ", bold: false }, { text: "Ana", bold: true }, { text: ".", bold: false }] },
    { type: "ul", items: [[{ text: "uno", bold: false }], [{ text: "dos", bold: true }]] },
    { type: "p", parts: [{ text: "fin", bold: false }] },
  ]);
});

test("el HTML se queda como texto y un ** sin cerrar no rompe nada", () => {
  assert.deepEqual(parseMarkdown("<b>x</b> **a"), [{ type: "p", parts: [{ text: "<b>x</b> **a", bold: false }] }]);
  assert.deepEqual(parseMarkdown(""), []);
});

test("listas numeradas se muestran como lista", () => {
  assert.deepEqual(parseMarkdown("1. Ana / Luis\n2. Marta / Pablo"), [{ type: "ul", items: [[{ text: "1. Ana / Luis", bold: false }], [{ text: "2. Marta / Pablo", bold: false }]] }]);
});

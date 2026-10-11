import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Regression: the base .skeleton rule was once removed by accident and every
// skeleton in the app rendered as an invisible empty box.
test("los skeletons tienen color y animación de carga", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const rule = css.match(/(?:^|\n)\.skeleton\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /background:\s*linear-gradient/, "falta el fondo del skeleton");
  assert.match(rule, /animation:\s*skeleton-shimmer/, "falta la animación del skeleton");
  assert.match(css, /@keyframes skeleton-shimmer/);
});

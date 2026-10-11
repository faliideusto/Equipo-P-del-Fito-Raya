import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Next 16 no longer disables CSS smooth scrolling during navigation unless <html> has
// data-scroll-behavior="smooth". Without it, every route change animated the scroll for
// almost a second, and on mobile the sticky header blinked during page transitions.
test("con scroll suave global, Next lo desactiva al navegar", async () => {
  const css = await readFile("src/app/globals.css", "utf8");
  const layout = await readFile("src/app/layout.tsx", "utf8");
  if (/html\s*\{[^}]*scroll-behavior:\s*smooth/.test(css)) assert.match(layout, /<html[^>]*data-scroll-behavior="smooth"/);
});
// Scroll anchoring kept the footer on screen when a short skeleton was replaced by a taller
// page, so returning to the team Resumen with the page scrolled jumped to its middle.
test("el anclaje de scroll está desactivado en toda la página", async () => {
  const css = await readFile("src/app/globals.css", "utf8");
  assert.match(css, /html\s*\{[^}]*overflow-anchor:\s*none/);
});

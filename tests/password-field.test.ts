import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PasswordField } from "../src/components/password-field";

// On iPhone, a visible password switches to a text input, where iOS capitalises the
// first letter and autocorrects unless told not to, so the typed password is changed.
test("la contraseña no se autocorrige ni se capitaliza en el móvil", () => {
  const html = renderToStaticMarkup(createElement(PasswordField, { name: "password", label: "Contraseña", autoComplete: "current-password" }));
  assert.match(html, /autoCapitalize="none"/i);
  assert.match(html, /autoCorrect="off"/i);
  assert.match(html, /spellCheck="false"/i);
});

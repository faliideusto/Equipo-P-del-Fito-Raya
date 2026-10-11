import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Before React hydrates (slow connection, slow dev compile) a form submits natively.
// Without method="post" that is a GET with every field in the URL: the login form once
// put the email and password in the address bar and in the server log.
test("todos los formularios usan method=\"post\"", async () => {
  const files = (await readdir("src", { recursive: true })).map(String).filter(f => f.endsWith(".tsx"));
  const offenders: string[] = [];
  for (const file of files) {
    const source = await readFile(path.join("src", file), "utf8");
    for (const form of source.match(/<form\b[^>]*>/g) ?? []) if (!/method="post"/.test(form)) offenders.push(`${file}: ${form.slice(0, 60)}`);
  }
  assert.deepEqual(offenders, []);
});

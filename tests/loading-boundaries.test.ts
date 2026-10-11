import test from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";

// Next shows the loading.tsx of the closest folder above the segment that changes.
// A loading.tsx in a folder with nested pages would replace the specific skeleton of
// every subpage (e.g. the calendar skeleton when moving between matchdays), so
// skeletons live only in leaf folders; parent pages go in route groups "(name)".
test("cada loading.tsx está en una carpeta sin subpáginas", async () => {
  const app = path.resolve("src/app");
  const files = (await readdir(app, { recursive: true })).map(f => f.toString());
  const loadings = files.filter(f => path.basename(f) === "loading.tsx").map(f => path.dirname(f));
  const pages = files.filter(f => path.basename(f) === "page.tsx").map(f => path.dirname(f));
  assert.ok(loadings.length > 5);
  for (const dir of loadings) {
    const nested = pages.filter(p => p !== dir && (dir === "." || p.startsWith(dir + path.sep)));
    assert.deepEqual(nested, [], `${dir}/loading.tsx taparía el skeleton de: ${nested.join(", ")}`);
  }
});

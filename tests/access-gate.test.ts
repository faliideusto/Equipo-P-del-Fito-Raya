import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
test("blocks unauthenticated pages and all data APIs while allowing access and health", async () => {
  for (const path of ["/", "/equipos/a/plantilla", "/competicion", "/mvp", "/mi-perfil", "/team-logos/private", "/sponsors/data.json"]) {
    const response = await proxy(new NextRequest(`https://club.example.invalid${path}`));
    assert.equal(response.status, 307); assert.equal(new URL(response.headers.get("location")!).pathname, "/acceso");
  }
  for (const path of ["/api/snp/competition", "/api/positions", "/api/mvp", "/api/account/stats"]) assert.equal((await proxy(new NextRequest(`https://club.example.invalid${path}`))).status, 401);
  for (const path of ["/acceso", "/api/account", "/api/account/roster?team=a", "/api/health", "/team-logos/top-bal.jpg", "/team-logos/padel-arcos.png", "/sponsors/logo.png", "/equipacion.png"]) assert.equal((await proxy(new NextRequest(`https://club.example.invalid${path}`))).headers.get("x-middleware-next"), "1");
  const forwarded = await proxy(new NextRequest("http://localhost:10000/equipos/a", { headers: { host: "club.example.invalid" } }));
  assert.equal(new URL(forwarded.headers.get("location")!).host, "club.example.invalid");
});
test("validates tokens, renews sessions, forwards new cookies and fails closed", async () => {
  const oldFetch = globalThis.fetch; const oldUrl = process.env.SUPABASE_URL; const oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://auth.example.invalid"; process.env.SUPABASE_SECRET_KEY = "fixture-key";
  try {
    globalThis.fetch = async () => Response.json({ id: "verified-user" });
    const valid = await proxy(new NextRequest("https://club.example.invalid/", { headers: { cookie: "fito-access=valid", "x-fito-access-page": "1" } }));
    assert.equal(valid.headers.get("x-middleware-next"), "1");
    assert.equal(valid.headers.get("x-middleware-request-x-fito-access-page"), "0");
    globalThis.fetch = async url => String(url).includes("/user") ? new Response(null, { status: 401 }) : Response.json({ access_token: "renewed", refresh_token: "rotated", expires_in: 3600, user: { id: "verified-user" } });
    const renewed = await proxy(new NextRequest("https://club.example.invalid/", { headers: { cookie: "fito-access=expired; fito-refresh=refresh" } }));
    assert.equal(renewed.cookies.get("fito-access")?.value, "renewed");
    assert.equal(renewed.cookies.get("fito-refresh")?.value, "rotated");
    assert.ok(renewed.headers.get("x-middleware-request-cookie")?.includes("fito-access=renewed"));
    globalThis.fetch = async () => new Response(null, { status: 401 });
    assert.equal((await proxy(new NextRequest("https://club.example.invalid/api/snp/teams/7778", { headers: { cookie: "fito-access=forged" } }))).status, 401);
    globalThis.fetch = async () => new Response(null, { status: 503 });
    assert.equal((await proxy(new NextRequest("https://club.example.invalid/", { headers: { cookie: "fito-access=valid" } }))).status, 503);
  } finally { globalThis.fetch = oldFetch; if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl; if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey; }
});

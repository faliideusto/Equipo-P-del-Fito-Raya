import test from "node:test";
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { googleObject, googleSaveUrl, googleWalletClient, heroVersion, signJwt } from "../src/lib/wallet-google";
import type { WalletCardData } from "../src/domain/wallet-card";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const config = { issuerId: "3388", clientEmail: "wallet@fito.iam.gserviceaccount.com", privateKey };
const card: WalletCardData = { teamId: "b", playerSourceId: "1", teamLabel: "Equipo B", playerName: "Carlos Martin", playerLine: "Carlos Martin · Revés", next: { round: "J5", opponent: "Rival", day: "Dom 18/10", time: "10:00", venue: "Local" }, matchDay: { start: "2026-10-17T22:00:00.000Z", end: "2026-10-18T22:00:00.000Z", at: "2026-10-18T08:00:00.000Z" }, nextMatch: "J5 · Rival · Dom 18/10 10:00 · Local", lineup: "No convocado en J5", lineupShort: "No convocado", lastResult: "Sin resultados todavía", snpPoints: "900", teamPath: "/equipos/b/jornadas", actaPath: null };
const meta = { serial: "11111111-1111-4111-8111-111111111111", baseUrl: "https://fito.example.com" };
const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());

test("objeto genérico rosa con logo redondo, imagen generada, módulos de texto, enlace y QR", () => {
  const object = googleObject(card, { issuerId: "3388", ...meta }) as { id: string; classId: string; state: string; hexBackgroundColor: string; logo: unknown; header: unknown; subheader: unknown; textModulesData: { id: string; body: string }[]; linksModuleData: { uris: unknown[] }; barcode: unknown; heroImage: unknown };
  assert.equal(object.id, "3388.11111111-1111-4111-8111-111111111111");
  assert.equal(object.classId, "3388.fito-raya-b");
  assert.equal(object.state, "ACTIVE");
  assert.equal(object.hexBackgroundColor, "#c2287a");
  assert.deepEqual(object.logo, { sourceUri: { uri: "https://fito.example.com/wallet/logo@3x.png" } });
  assert.deepEqual(object.header, { defaultValue: { language: "es", value: "Carlos Martin" } });
  assert.deepEqual(object.subheader, { defaultValue: { language: "es", value: "Puntos SNP · 900" } });
  assert.deepEqual(object.textModulesData.map(m => [m.id, m.body]), [["next", card.nextMatch], ["lineup", card.lineup], ["result", card.lastResult], ["points", "900"]]);
  assert.deepEqual(object.linksModuleData.uris, [{ id: "web", uri: "https://fito.example.com/equipos/b/jornadas", description: "Web del equipo" }]);
  assert.deepEqual(object.heroImage, { sourceUri: { uri: `https://fito.example.com/api/wallet/google/hero/${meta.serial}?v=${heroVersion(card)}` }, contentDescription: { defaultValue: { language: "es", value: card.nextMatch } } });
  assert.deepEqual(object.barcode, { type: "QR_CODE", value: "https://fito.example.com/mi-perfil" });
});
test("JWT de guardar firmado RS256 con clase y objeto", () => {
  const url = googleSaveUrl(card, meta, config, 1_760_000_000_000);
  assert.match(url, /^https:\/\/pay\.google\.com\/gp\/v\/save\//);
  const [header, claims, signature] = url.split("/").pop()!.split(".");
  assert.deepEqual(decode(header), { alg: "RS256", typ: "JWT" });
  const body = decode(claims);
  assert.equal(body.iss, config.clientEmail); assert.equal(body.aud, "google"); assert.equal(body.typ, "savetowallet");
  assert.equal(body.iat, 1_760_000_000); assert.deepEqual(body.origins, ["https://fito.example.com"]);
  assert.deepEqual(body.payload.genericClasses, [{ id: "3388.fito-raya-b" }]);
  assert.equal(body.payload.genericObjects[0].id, "3388.11111111-1111-4111-8111-111111111111");
  assert.equal(createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, signature, "base64url"), true);
});
test("signJwt produce tres partes verificables", () => {
  const [h, c, s] = signJwt({ a: 1 }, privateKey).split(".");
  assert.deepEqual(decode(c), { a: 1 });
  assert.equal(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, s, "base64url"), true);
});
test("cliente: token cacheado, PATCH + addMessage y resultados", async () => {
  const calls: { url: string; method: string; body: string }[] = [];
  let patchStatus = 200; let messageStatus = 200;
  const fake = (async (input: URL | string, init?: RequestInit) => {
    const url = String(input); calls.push({ url, method: init?.method ?? "GET", body: String(init?.body ?? "") });
    if (url.startsWith("https://oauth2.googleapis.com/token")) return Response.json({ access_token: "tok", expires_in: 3600 });
    return new Response("{}", { status: url.endsWith("/addMessage") ? messageStatus : patchStatus });
  }) as typeof fetch;
  const client = googleWalletClient(config, fake, () => 1_760_000_000_000);
  const notice = { header: "Convocatoria J5", body: "No convocado en J5" };
  assert.equal(await client.update("3388.s", { id: "3388.s" }, notice, "lineup-50-1"), "ok");
  assert.equal(calls.filter(c => c.url.includes("oauth2")).length, 1);
  assert.equal(calls[1].method, "PATCH");
  assert.match(calls[1].url, /\/genericObject\/3388\.s$/);
  assert.deepEqual(JSON.parse(calls[2].body), { message: { id: "lineup-50-1", header: "Convocatoria J5", body: "No convocado en J5", messageType: "TEXT_AND_NOTIFY" } });
  assert.equal(await client.update("3388.s", {}, null, "x"), "ok");
  assert.equal(calls.filter(c => c.url.includes("oauth2")).length, 1);
  messageStatus = 429; assert.equal(await client.update("3388.s", {}, notice, "y"), "rateLimited");
  patchStatus = 404; assert.equal(await client.update("3388.s", {}, notice, "z"), "missing");
  patchStatus = 500; assert.equal(await client.update("3388.s", {}, notice, "w"), "failed");
  const broken = googleWalletClient(config, (async () => { throw new Error("red"); }) as typeof fetch);
  assert.equal(await broken.update("3388.s", {}, null, "v"), "failed");
});
test("la URL de la imagen cambia solo cuando cambia lo que dibuja", () => {
  assert.match(heroVersion(card), /^[0-9a-f]{12}$/);
  assert.equal(heroVersion({ ...card, snpPoints: "1.000", lastResult: "J4 · Fito Raya B 7–5 X" }), heroVersion(card));
  assert.notEqual(heroVersion({ ...card, lineupShort: "Pareja 1 con Ana" }), heroVersion(card));
  assert.notEqual(heroVersion({ ...card, next: { ...card.next!, opponent: "Otro" } }), heroVersion(card));
});

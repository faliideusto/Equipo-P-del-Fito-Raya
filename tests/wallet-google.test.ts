import test from "node:test";
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { googleObject, googleSaveUrl, googleWalletClient, signJwt } from "../src/lib/wallet-google";
import type { WalletCardData } from "../src/domain/wallet-card";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const config = { issuerId: "3388", clientEmail: "wallet@fito.iam.gserviceaccount.com", privateKey };
const card: WalletCardData = { teamId: "b", playerSourceId: "1", teamLabel: "Equipo B", playerName: "Carlos Martin", playerLine: "Carlos Martin · Revés", next: { round: "J5", opponent: "Rival", day: "Dom 18/10", time: "10:00", venue: "Local" }, matchDay: { start: "2026-10-17T22:00:00.000Z", end: "2026-10-18T22:00:00.000Z", at: "2026-10-18T08:00:00.000Z" }, nextMatch: "J5 · Rival · Dom 18/10 10:00 · Local", lineup: "No convocado en J5", lineupShort: "No convocado", lastResult: "Sin resultados todavía", snpPoints: "900", teamPath: "/equipos/b/jornadas", actaPath: null };
const meta = { serial: "11111111-1111-4111-8111-111111111111", baseUrl: "https://fito.example.com" };
const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());

test("objeto genérico con módulos de texto, enlace y QR", () => {
  const object = googleObject(card, { issuerId: "3388", ...meta }) as { id: string; classId: string; state: string; hexBackgroundColor: string; textModulesData: { id: string; body: string }[]; linksModuleData: { uris: unknown[] }; barcode: unknown; heroImage: unknown };
  assert.equal(object.id, "3388.11111111-1111-4111-8111-111111111111");
  assert.equal(object.classId, "3388.fito-raya-b");
  assert.equal(object.state, "ACTIVE");
  assert.equal(object.hexBackgroundColor, "#0a1825");
  assert.deepEqual(object.textModulesData.map(m => [m.id, m.body]), [["next", card.nextMatch], ["lineup", card.lineup], ["result", card.lastResult], ["points", "900"]]);
  assert.deepEqual(object.linksModuleData.uris, [{ id: "web", uri: "https://fito.example.com/equipos/b/jornadas", description: "Web del equipo" }]);
  assert.deepEqual(object.heroImage, { sourceUri: { uri: "https://fito.example.com/wallet/strip@3x.png" } });
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

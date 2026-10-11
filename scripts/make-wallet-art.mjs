// Draws the Wallet pass art at 1x, 2x and 3x: the pink-to-purple kit gradient (background, 180x220 pt)
// and the round logo (50x50 pt) cut from public/logo-fito.png. Run: node scripts/make-wallet-art.mjs
import { deflateSync, inflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buffer => { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]); const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), body.length + 4); return out;
}
// RGBA PNG; pixel(x, y) returns [r, g, b, a].
function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw.set(pixel(x, y), y * (width * 4 + 1) + 1 + x * 4);
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
// Reads an 8-bit, non-interlaced RGB or RGBA PNG into rows of [r, g, b].
function readPng(file) {
  const data = readFileSync(file); let width = 0, height = 0, channels = 0; const idat = [];
  for (let at = 8; at < data.length;) {
    const length = data.readUInt32BE(at), type = data.toString("ascii", at + 4, at + 8), body = data.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") { width = body.readUInt32BE(0); height = body.readUInt32BE(4); channels = { 2: 3, 6: 4 }[body[9]]; if (body[8] !== 8 || !channels || body[12]) throw new Error(`${file}: PNG no soportado`); }
    if (type === "IDAT") idat.push(body);
    at += length + 12;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = width * channels, rows = []; let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0, b = previous[i], c = i >= channels ? previous[i - channels] : 0;
      const paeth = () => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
      line[i] = (line[i] + [0, a, b, (a + b) >> 1, paeth()][filter]) & 0xff;
    }
    rows.push(Array.from({ length: width }, (_, x) => [line[x * channels], line[x * channels + 1], line[x * channels + 2]])); previous = line;
  }
  return { width, height, rows };
}
const PINK = [236, 64, 150], PURPLE = [98, 38, 168], WHITE = [255, 255, 255];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
// Diagonal gradient, pink at the top left. Wallet blurs the background, so a smooth gradient survives it.
function background(scale) {
  const width = 180 * scale, height = 220 * scale;
  return png(width, height, (x, y) => [...mix(PINK, PURPLE, Math.min(1, (x / width) * 0.35 + (y / height) * 0.75)), 255]);
}
// White disc with the logo shrunk inside it, so no letter touches the edge; 4x4 samples per pixel smooth the scaling and the rim.
const logo = readPng("public/logo-fito.png");
function sample(x, y) {
  const fx = Math.min(logo.width - 1, Math.max(0, x)), fy = Math.min(logo.height - 1, Math.max(0, y)), x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(logo.width - 1, x0 + 1), y1 = Math.min(logo.height - 1, y0 + 1);
  return mix(mix(logo.rows[y0][x0], logo.rows[y0][x1], fx - x0), mix(logo.rows[y1][x0], logo.rows[y1][x1], fx - x0), fy - y0);
}
function roundLogo(scale) {
  const size = 50 * scale, radius = size / 2, inner = size * 0.84, offset = (size - inner) / 2, steps = 4;
  return png(size, size, (x, y) => {
    let covered = 0; const sum = [0, 0, 0];
    for (let sy = 0; sy < steps; sy++) for (let sx = 0; sx < steps; sx++) {
      const px = x + (sx + 0.5) / steps, py = y + (sy + 0.5) / steps;
      if ((px - radius) ** 2 + (py - radius) ** 2 > radius ** 2) continue;
      const inside = px >= offset && px <= size - offset && py >= offset && py <= size - offset;
      const color = inside ? sample(((px - offset) / inner) * logo.width - 0.5, ((py - offset) / inner) * logo.height - 0.5) : WHITE;
      covered++; color.forEach((v, i) => { sum[i] += v; });
    }
    return covered ? [...sum.map(v => Math.round(v / covered)), Math.round((covered / steps ** 2) * 255)] : [0, 0, 0, 0];
  });
}
mkdirSync("public/wallet", { recursive: true });
for (const [scale, suffix] of [[1, ""], [2, "@2x"], [3, "@3x"]]) {
  writeFileSync(`public/wallet/background${suffix}.png`, background(scale));
  writeFileSync(`public/wallet/logo${suffix}.png`, roundLogo(scale));
}

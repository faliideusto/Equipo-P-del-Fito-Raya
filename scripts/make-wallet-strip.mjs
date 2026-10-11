// Draws the padel court strip of the Wallet pass (375x98 pt) at 1x, 2x and 3x. Run: node scripts/make-wallet-strip.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buffer => { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]); const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), body.length + 4); return out;
}
function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const [r, g, b] = pixel(x, y); const i = y * (width * 3 + 1) + 1 + x * 3; raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const COURT = [29, 95, 138], NAVY = [10, 24, 37], WHITE = [255, 255, 255];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
// Court seen from above: outer lines, net in the middle and both service lines; darker at the bottom so the text stays readable.
function court(scale) {
  const width = 375 * scale, height = 98 * scale, line = Math.max(1, Math.round(1.5 * scale));
  const left = 26 * scale, right = width - 26 * scale, top = 12 * scale, bottom = height - 12 * scale, net = Math.round(width / 2);
  const service = [left + Math.round((net - left) * 0.42), right - Math.round((right - net) * 0.42)], middle = Math.round(height / 2);
  const near = (value, target) => Math.abs(value - target) < line / 2 + 0.5;
  return png(width, height, (x, y) => {
    const base = mix(COURT, NAVY, 0.25 + 0.6 * (y / height) ** 1.4);
    const inside = x >= left && x <= right && y >= top && y <= bottom;
    const onLine = inside && (near(x, left) || near(x, right) || near(y, top) || near(y, bottom) || near(x, net) || service.some(s => near(x, s)) || (near(y, middle) && x >= service[0] && x <= service[1]));
    return onLine ? mix(base, WHITE, 0.42) : base;
  });
}
mkdirSync("public/wallet", { recursive: true });
for (const [scale, name] of [[1, "strip.png"], [2, "strip@2x.png"], [3, "strip@3x.png"]]) writeFileSync(`public/wallet/${name}`, court(scale));

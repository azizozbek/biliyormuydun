// Draws the PWA icons (flat blue, white heart in the centre) as PNGs with no dependencies.
// Run: npm run icons  →  static/img/icon-192.png, icon-512.png, maskable-512.png
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BLUE = [0x2b, 0x3f, 0xd9];

// colour at normalised point (u, v) in [0,1]; `pad` shrinks the heart for maskable icons
function shade(u, v, pad) {
  const x = (u - 0.5) / (1 - 2 * pad), y = (v - 0.5) / (1 - 2 * pad);
  // heart: (X² + Y² − 1)³ − X²·Y³ ≤ 0, centred
  const s = 4.4, X = x * s, Y = -(y * s) + 0.2;
  return (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0 ? [255, 255, 255] : BLUE;
}

function png(size, pad) {
  const SS = 4; // supersampling for smooth edges
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let c = [0, 0, 0];
      for (let j = 0; j < SS; j++)
        for (let i = 0; i < SS; i++) {
          const p = shade((x + (i + 0.5) / SS) / size, (y + (j + 0.5) / SS) / size, pad);
          c = c.map((v, k) => v + p[k]);
        }
      c.forEach((v, k) => (raw[y * (size * 3 + 1) + 1 + x * 3 + k] = Math.round(v / SS / SS)));
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4), tc = Buffer.concat([Buffer.from(type), data]), sum = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    sum.writeUInt32BE(crc(tc));
    return Buffer.concat([len, tc, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = (f) => new URL(`../static/img/${f}`, import.meta.url);
writeFileSync(out("icon-192.png"), png(192, 0));
writeFileSync(out("icon-512.png"), png(512, 0));
writeFileSync(out("maskable-512.png"), png(512, 0.12)); // keeps the heart inside the 80% safe zone
writeFileSync(out("apple-touch-icon.png"), png(180, 0));
console.log("icons written to static/img/");

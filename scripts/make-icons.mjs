// Draws Plate's app icon (a white plate on blue) as PNGs with no image
// libraries: rasterise with 4x4 supersampling, encode with node:zlib.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BG = [0x1d, 0x5f, 0xd6];
const WHITE = [0xff, 0xff, 0xff];
const RIM = [0xd6, 0xe3, 0xfa];

// Coverage colour at a point in unit coordinates (0..1), centre at 0.5.
function colourAt(x, y) {
  const r = Math.hypot(x - 0.5, y - 0.5);
  if (r <= 0.36 && r >= 0.335) return RIM; // outer edge line
  if (r < 0.36 && r > 0.25) return WHITE; // rim
  if (r <= 0.25 && r >= 0.232) return RIM; // inner edge line
  if (r < 0.232) return WHITE; // well
  return BG;
}

function render(size) {
  const S = 4;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let rr = 0, gg = 0, bb = 0;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const c = colourAt((px + (sx + 0.5) / S) / size, (py + (sy + 0.5) / S) / size);
          rr += c[0]; gg += c[1]; bb += c[2];
        }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      raw[o] = rr / (S * S); raw[o + 1] = gg / (S * S); raw[o + 2] = bb / (S * S); raw[o + 3] = 255;
    }
  }
  return png(size, size, raw);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public", { recursive: true });
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  writeFileSync(`public/${name}`, render(size));
  console.log(`public/${name}`);
}

// Builds public/data/sky/milky-way-sky.jpg from NASA SVS "Deep Star Maps 2020" (svs.gsfc.nasa.gov/4851,
// Ernie Wright/USRA, public domain): milkyway_2020_4k.exr, the Milky Way with the Hipparcos/Tycho stars removed.
// Plate carrée in J2000: RA 0h at the centre, RA increasing to the left, Dec +90° on the top row,
//   u = frac(0.5 − RA/360), v = (90 − Dec)/180.
//   node tools/build-milky-way-sky.mjs [path/to/milkyway_2020_4k.exr]   (downloads it without a path)
import { mkdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { FloatType } from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

const SRC = 'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/milkyway_2020_4k.exr';
const OUT = 'public/data/sky/milky-way-sky.jpg';
const BLUR_SIGMA = 1;
// Linear levels; the sky between the band sits below BLACK and must clip to 0 for additive drawing.
const BLACK = 0.008;
const WHITE = 0.7;
const SATURATION = 0.6;

async function exr() {
  const path = process.argv[2];
  if (path) return readFileSync(path);
  const res = await fetch(SRC);
  if (!res.ok) throw new Error(`SVS HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function gaussian(sigma) {
  const r = Math.ceil(sigma * 3);
  const k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)));
  const sum = k.reduce((a, b) => a + b);
  return { r, k: k.map((v) => v / sum) };
}

// Horizontal sigma grows as 1/cos(Dec) so the blur is the same angle on the sky and the polar rows don't streak.
function blur(src, W, H, sigma) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < H; y++) {
    const cos = Math.cos(((y + 0.5) / H - 0.5) * Math.PI);
    const { r, k } = gaussian(Math.min(W / 8, sigma / cos));
    for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
      let a = 0;
      for (let j = -r; j <= r; j++) a += k[j + r] * src[(y * W + ((x + j + W) % W)) * 4 + c];
      tmp[(y * W + x) * 4 + c] = a;
    }
  }
  const { r, k } = gaussian(sigma);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    let a = 0;
    for (let j = -r; j <= r; j++) a += k[j + r] * tmp[(Math.min(H - 1, Math.max(0, y + j)) * W + x) * 4 + c];
    out[(y * W + x) * 4 + c] = a;
  }
  return out;
}

const srgb = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

const buf = await exr();
const { width: W, height: H, data } = new EXRLoader()
  .setDataType(FloatType)
  .parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const lin = blur(data, W, H, BLUR_SIGMA);
const floor = srgb(BLACK / WHITE);
const px = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  // EXRLoader returns scanlines bottom-up.
  const i = ((H - 1 - y) * W + x) * 4;
  const o = (y * W + x) * 3;
  const rgb = [lin[i], lin[i + 1], lin[i + 2]];
  const L = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const level = Math.max(0, (srgb(Math.min(1, L / WHITE)) - floor) / (1 - floor));
  if (level === 0) continue;
  for (let c = 0; c < 3; c++) px[o + c] = Math.round(255 * Math.min(1, Math.max(0, level * (1 + SATURATION * (rgb[c] / L - 1)))));
}

mkdirSync('public/data/sky', { recursive: true });
const info = await sharp(px, { raw: { width: W, height: H, channels: 3 } })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(OUT);
console.log(`${OUT}: ${info.width}×${info.height}, ${(info.size / 1024).toFixed(0)} KB`);

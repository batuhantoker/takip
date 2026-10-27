// Builds public/data/sky/galactic-stars.bin, the Milky Way around the Sun as real 3D points between the nearby
// stars and the galaxy's disc: Gaia DR3 (ESA/Gaia/DPAC, CC BY-SA 3.0 IGO) from the ESA Gaia archive TAP. Two samples:
//   field     a random sample of stars with parallax_over_error > 10 beyond 100 ly (nearby-stars.json holds the
//             rest) and fainter than G 6 (the Yale Bright Stars are in nearby-stars.json too); mostly within ~3,000 ly.
//   luminous  a random third of the giants and young hot stars (absolute G < −1) with parallax_over_error > 5 out to
//             parallax 0.15 mas (~22,000 ly), which trace the disc and its arms far past the field.
// Distances are 1/parallax; no extinction correction, so absolute magnitudes of reddened stars come out faint.
// Positions are Gaia's J2016 epoch; over 16 years proper motion moves no star by a visible fraction of a light-year.
//   nice node tools/build-galactic-stars.mjs [cache-dir]   (keeps raw downloads there for offline rebuilds)
//
// Format, little-endian: uint32 magic 'GSTR', uint32 section count; then per section uint32 count, float32
// light-years per unit, and `count` 8-byte records: int16 x, y, z (J2000 equatorial), uint8 absolute V
// (abs = b / 8 − 8), uint8 Gaia BP−RP (c = b / 50 − 0.5).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const OUT = 'public/data/sky/galactic-stars.bin';
const TAP = 'https://gea.esac.esa.int/tap-server/tap/async';
const LY_MAS = 3261.56;
const R = Math.PI / 180;
const CACHE = process.argv[2];
const COLUMNS = 'source_id, ra, dec, parallax, phot_g_mean_mag, bp_rp';
// gaia_source has ~1.81 billion rows; random_index is a shuffled 0…N−1, so a bound on it is a random sample.
const SAMPLES = [
  ['field', `random_index < 2000000 AND parallax_over_error > 10 AND parallax > 0.3 AND parallax <= 32.6 AND phot_g_mean_mag >= 6`],
  ['luminous', `random_index < 600000000 AND parallax_over_error > 5 AND parallax > 0.15 AND parallax < 100 * POWER(10, (-1 - phot_g_mean_mag) / 5)`],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cached(key, load) {
  const file = CACHE && `${CACHE}/${createHash('sha1').update(key).digest('hex').slice(0, 16)}`;
  if (file && existsSync(file)) return readFileSync(file, 'utf8');
  const data = await load();
  if (file) { mkdirSync(CACHE, { recursive: true }); writeFileSync(file, data); }
  return data;
}

// Results stop at 50,000 rows unless MAXREC asks for more; an async job may return up to a few million.
const MAXREC = 1_000_000;

async function tapAsync(query) {
  const res = await fetch(TAP, {
    method: 'POST', redirect: 'manual',
    body: new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', PHASE: 'RUN', MAXREC: String(MAXREC), QUERY: query }),
  });
  const job = res.headers.get('location');
  if (!job) throw new Error(`Gaia TAP HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  for (let wait = 2000; ; wait = Math.min(wait * 1.5, 20000)) {
    await sleep(wait);
    const phase = (await (await fetch(`${job}/phase`)).text()).trim();
    if (phase === 'COMPLETED') break;
    if (phase === 'ERROR' || phase === 'ABORTED') throw new Error(`Gaia job ${job}: ${phase}: ${(await (await fetch(`${job}/error`)).text()).slice(0, 600)}`);
  }
  const out = await fetch(`${job}/results/result`);
  if (!out.ok) throw new Error(`Gaia job ${job} result HTTP ${out.status}`);
  return out.text();
}

function rows(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const keys = head.split(',');
  return lines.map((line) => Object.fromEntries(line.split(',').map((v, i) => [keys[i], v])));
}

const num = (v) => (v === '' || v == null ? NaN : Number(v));
// G − V as a cubic in BP−RP (Gaia DR3 documentation, Riello et al. 2021), as tools/build-nearby-stars.mjs uses it.
const vFromG = (g, c) => (Number.isFinite(c) ? g - (-0.02704 + 0.01424 * c - 0.2156 * c ** 2 + 0.01426 * c ** 3) : g + 0.5);

const seen = new Set();
const sections = [];
for (const [name, where] of SAMPLES) {
  console.log(`Gaia DR3 ${name}…`);
  const list = rows(await cached(`${MAXREC} ${where}`, () => tapAsync(`SELECT ${COLUMNS} FROM gaiadr3.gaia_source WHERE ${where}`)));
  if (list.length === MAXREC || list.length === 50000) throw new Error(`${name}: ${list.length} rows, the result was cut off`);
  const stars = [];
  for (const r of list) {
    if (seen.has(r.source_id)) continue;
    seen.add(r.source_id);
    const plx = num(r.parallax), g = num(r.phot_g_mean_mag), c = num(r.bp_rp);
    if (!(plx > 0) || !Number.isFinite(g)) continue;
    const ly = LY_MAS / plx, ra = num(r.ra) * R, dec = num(r.dec) * R;
    const cd = Math.cos(dec);
    const abs = vFromG(g, c) + 5 * Math.log10(plx / 100);
    stars.push([ly * cd * Math.cos(ra), ly * cd * Math.sin(ra), ly * Math.sin(dec), abs, Number.isFinite(c) ? c : 1]);
  }
  const maxAbs = Math.max(...stars.map((s) => Math.max(Math.abs(s[0]), Math.abs(s[1]), Math.abs(s[2]))));
  sections.push({ name, stars, lyPerUnit: maxAbs / 32767 });
  console.log(`  ${list.length} rows, ${stars.length} kept, out to ${Math.round(maxAbs).toLocaleString()} ly on an axis`);
}

const total = sections.reduce((n, s) => n + s.stars.length, 0);
const buf = Buffer.alloc(8 + sections.length * 8 + total * 8);
buf.write('GSTR', 0, 'latin1');
buf.writeUInt32LE(sections.length, 4);
let at = 8;
const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));
for (const { stars, lyPerUnit } of sections) {
  buf.writeUInt32LE(stars.length, at);
  buf.writeFloatLE(lyPerUnit, at + 4);
  at += 8;
  for (const [x, y, z, abs, c] of stars) {
    buf.writeInt16LE(Math.round(x / lyPerUnit), at);
    buf.writeInt16LE(Math.round(y / lyPerUnit), at + 2);
    buf.writeInt16LE(Math.round(z / lyPerUnit), at + 4);
    buf.writeUInt8(clampByte((abs + 8) * 8), at + 6);
    buf.writeUInt8(clampByte((c + 0.5) * 50), at + 7);
    at += 8;
  }
}
mkdirSync('public/data/sky', { recursive: true });
writeFileSync(OUT, buf);
console.log(`${OUT}: ${total} stars (${sections.map((s) => `${s.name} ${s.stars.length} at ${s.lyPerUnit.toFixed(3)} ly/unit`).join(', ')}), ${(statSync(OUT).size / 1024).toFixed(0)} KB`);

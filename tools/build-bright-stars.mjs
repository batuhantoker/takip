// Builds public/data/sky/bright-stars.json from the Yale Bright Star Catalogue
// (5th ed., Hoffleit & Warren 1991; CDS catalogue V/50), stars to magnitude 5.5.
//   node tools/build-bright-stars.mjs [path/to/catalog]   (downloads it without a path)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const MAX_MAG = 5.5;
const OUT = 'public/data/sky/bright-stars.json';

// Proper names, placed by rough J2000 position and snapped to the nearest catalogue star.
const NAMED = [
  ['Sirius', 101.29, -16.72], ['Canopus', 95.99, -52.70], ['Rigil Kentaurus', 219.90, -60.83], ['Arcturus', 213.92, 19.18],
  ['Vega', 279.23, 38.78], ['Capella', 79.17, 46.00], ['Rigel', 78.63, -8.20], ['Procyon', 114.83, 5.23],
  ['Achernar', 24.43, -57.24], ['Betelgeuse', 88.79, 7.41], ['Hadar', 210.96, -60.37], ['Altair', 297.70, 8.87],
  ['Acrux', 186.65, -63.10], ['Aldebaran', 68.98, 16.51], ['Antares', 247.35, -26.43], ['Spica', 201.30, -11.16],
  ['Pollux', 116.33, 28.03], ['Fomalhaut', 344.41, -29.62], ['Deneb', 310.36, 45.28], ['Mimosa', 191.93, -59.69],
  ['Regulus', 152.09, 11.97], ['Castor', 113.65, 31.89], ['Polaris', 37.95, 89.26], ['Bellatrix', 81.28, 6.35],
  ['Alnilam', 84.05, -1.20], ['Alnitak', 85.19, -1.94], ['Mintaka', 83.00, -0.30], ['Saiph', 86.94, -9.67],
  ['Dubhe', 165.93, 61.75], ['Merak', 165.46, 56.38], ['Phecda', 178.46, 53.69], ['Megrez', 183.86, 57.03],
  ['Alioth', 193.51, 55.96], ['Mizar', 200.98, 54.93], ['Alkaid', 206.89, 49.31], ['Gacrux', 187.79, -57.11],
  ['Imai', 183.79, -58.75], ['Schedar', 10.13, 56.54], ['Caph', 2.29, 59.15], ['Navi', 14.18, 60.72],
  ['Ruchbah', 21.45, 60.24], ['Segin', 28.60, 63.67],
];

// A few figures most people know, as name pairs.
const ASTERISMS = [
  ['Betelgeuse', 'Bellatrix'], ['Bellatrix', 'Mintaka'], ['Mintaka', 'Alnilam'], ['Alnilam', 'Alnitak'],
  ['Alnitak', 'Saiph'], ['Saiph', 'Rigel'], ['Rigel', 'Mintaka'], ['Betelgeuse', 'Alnitak'],
  ['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Dubhe'],
  ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid'],
  ['Acrux', 'Gacrux'], ['Mimosa', 'Imai'],
  ['Caph', 'Schedar'], ['Schedar', 'Navi'], ['Navi', 'Ruchbah'], ['Ruchbah', 'Segin'],
];

async function catalogue() {
  const path = process.argv[2];
  if (path) return readFileSync(path, 'utf8');
  const res = await fetch('https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz');
  if (!res.ok) throw new Error(`CDS HTTP ${res.status}`);
  return gunzipSync(Buffer.from(await res.arrayBuffer())).toString('latin1');
}

// Byte columns per the catalogue's ReadMe (1-based, inclusive).
const col = (line, a, b) => line.slice(a - 1, b).trim();

const stars = [];
for (const line of (await catalogue()).split('\n')) {
  const mag = Number(col(line, 103, 107));
  if (!col(line, 76, 77) || !Number.isFinite(mag) || mag > MAX_MAG) continue;
  const ra = (Number(col(line, 76, 77)) + Number(col(line, 78, 79)) / 60 + Number(col(line, 80, 83)) / 3600) * 15;
  const dec = (col(line, 84, 84) === '-' ? -1 : 1) * (Number(col(line, 85, 86)) + Number(col(line, 87, 88)) / 60 + Number(col(line, 89, 90)) / 3600);
  const bv = Number(col(line, 110, 114));
  stars.push([+ra.toFixed(3), +dec.toFixed(3), mag, Number.isFinite(bv) ? bv : 0]);
}

const angle = (a, b) => {
  const r = Math.PI / 180;
  const c = Math.sin(a[1] * r) * Math.sin(b[1] * r) + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.cos((a[0] - b[0]) * r);
  return Math.acos(Math.min(1, c)) / r;
};

const names = {};
for (const [name, ra, dec] of NAMED) {
  let best = -1, bestD = Infinity;
  stars.forEach((s, i) => { const d = angle(s, [ra, dec]); if (d < bestD) { bestD = d; best = i; } });
  if (bestD > 0.5) throw new Error(`${name}: nearest catalogue star is ${bestD.toFixed(2)}° away`);
  names[best] = name;
}
const index = Object.fromEntries(Object.entries(names).map(([i, n]) => [n, Number(i)]));
const asterisms = ASTERISMS.map(([a, b]) => [index[a], index[b]]);

mkdirSync('public/data/sky', { recursive: true });
writeFileSync(OUT, JSON.stringify({
  source: 'Yale Bright Star Catalogue, 5th revised ed. (Hoffleit & Warren 1991), CDS V/50. J2000 [ra°, dec°, Vmag, B-V].',
  stars, names, asterisms,
}));
console.log(`${OUT}: ${stars.length} stars to magnitude ${MAX_MAG}, ${Object.keys(names).length} named`);

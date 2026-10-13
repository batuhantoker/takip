// Builds public/data/sky/nearby-stars.json, the stars the space view draws as 3D points:
// every Yale Bright Star Catalogue star to V 5.5 (5th ed., CDS V/50) placed by its Hipparcos-2 parallax
// (van Leeuwen 2007), every Gaia DR3 source within 100 ly (ESA/Gaia/DPAC), and the Hipparcos-2 stars
// within 100 ly that Gaia DR3 has no parallax for. Hipparcos and Gaia come from the ESA Gaia archive TAP.
//   nice node tools/build-nearby-stars.mjs [cache-dir]   (keeps raw downloads there for offline rebuilds)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const OUT = 'public/data/sky/nearby-stars.json';
const TAP = 'https://gea.esac.esa.int/tap-server/tap/sync';
const MAX_MAG = 5.5;
const MIN_PLX = 32.6;
const LY_MAS = 3261.56;
const FAR_LY = 3000;
const R = Math.PI / 180;
const CACHE = process.argv[2];

// Proper names from build-bright-stars.mjs, snapped to the nearest BSC star like that script.
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

// [name, ra°, dec° (SIMBAD, ICRS J2000), distance ly, V]; V separates close pairs such as α Cen A/B.
const NEARBY = [
  ['Proxima Centauri', 217.4289, -62.6795, 4.25, 11.13], ['Toliman', 219.8961, -60.8375, 4.39, 1.33],
  ["Barnard's Star", 269.4521, 4.6934, 5.96, 9.51], ['Wolf 359', 164.1205, 7.0147, 7.86, 13.51],
  ['Lalande 21185', 165.8341, 35.9699, 8.30, 7.52], ['Luyten 726-8', 24.7557, -17.9507, 8.87, 12.5],
  ['Ross 154', 282.4557, -23.8362, 9.71, 10.43], ['Ross 248', 355.4793, 44.1774, 10.31, 12.3],
  ['Epsilon Eridani', 53.2327, -9.4583, 10.50, 3.73], ['Lacaille 9352', 346.4668, -35.8531, 10.72, 7.39],
  ['Ross 128', 176.9350, 0.8046, 11.01, 11.15], ['61 Cygni A', 316.7247, 38.7494, 11.40, 5.21],
  ['Epsilon Indi', 330.8402, -56.7860, 11.87, 4.69], ['Tau Ceti', 26.0170, -15.9375, 11.91, 3.50],
  ["Luyten's Star", 111.8521, 5.2258, 12.35, 9.87], ["Teegarden's Star", 43.2537, 16.8813, 12.50, 15.14],
  ["Kapteyn's Star", 77.9191, -45.0184, 12.83, 8.85], ['Lacaille 8760', 319.3136, -38.8674, 12.95, 6.68],
  ['Kruger 60', 336.9982, 57.6950, 13.08, 9.59], ['Groombridge 34', 4.5954, 44.0230, 11.62, 8.14],
  ["Van Maanen's Star", 12.2912, 5.3886, 14.07, 12.37], ['TRAPPIST-1', 346.6224, -5.0414, 40.66, 18.80],
  ['Gliese 581', 229.8618, -7.7223, 20.55, 10.56], ['Gliese 667 C', 259.7451, -34.9968, 23.62, 10.22],
  ['55 Cancri', 133.1492, 28.3308, 41.05, 5.95], ['51 Pegasi', 344.3666, 20.7688, 50.64, 5.46],
  ['HD 189733', 300.1821, 22.7109, 64.50, 7.65], ['40 Eridani', 63.8180, -7.6529, 16.34, 4.43],
  ['Sadr', 305.5571, 40.2567, 1832, 2.23], ['Albireo', 292.6803, 27.9597, 363, 3.08],
  ['Gienah', 311.5528, 33.9703, 75.5, 2.48], ['Fawaris', 296.2437, 45.1308, 154, 2.87],
];

const ASTERISMS = [
  ['Betelgeuse', 'Bellatrix'], ['Bellatrix', 'Mintaka'], ['Mintaka', 'Alnilam'], ['Alnilam', 'Alnitak'],
  ['Alnitak', 'Saiph'], ['Saiph', 'Rigel'], ['Rigel', 'Mintaka'], ['Betelgeuse', 'Alnitak'],
  ['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Dubhe'],
  ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid'],
  ['Acrux', 'Gacrux'], ['Mimosa', 'Imai'],
  ['Caph', 'Schedar'], ['Schedar', 'Navi'], ['Navi', 'Ruchbah'], ['Ruchbah', 'Segin'],
  ['Deneb', 'Sadr'], ['Sadr', 'Albireo'], ['Gienah', 'Sadr'], ['Sadr', 'Fawaris'],
  ['Vega', 'Deneb'], ['Deneb', 'Altair'], ['Altair', 'Vega'],
];

const VERIFY = ['Sirius', 'Rigil Kentaurus', 'Toliman', 'Proxima Centauri', 'Procyon', 'Altair', 'Vega',
  'Fomalhaut', 'Pollux', 'Deneb', 'Sadr', 'Kruger 60', '61 Cygni A', 'Epsilon Eridani', 'TRAPPIST-1'];

async function cached(key, load) {
  const file = CACHE && `${CACHE}/${createHash('sha1').update(key).digest('hex').slice(0, 16)}`;
  if (file && existsSync(file)) return readFileSync(file);
  const data = await load();
  if (file) { mkdirSync(CACHE, { recursive: true }); writeFileSync(file, data); }
  return data;
}

async function tap(query) {
  const text = (await cached(query, async () => {
    const res = await fetch(TAP, { method: 'POST', body: new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: query }) });
    const body = await res.text();
    if (!res.ok || body.startsWith('<')) throw new Error(`Gaia TAP HTTP ${res.status}: ${body.slice(0, 400)}`);
    return body;
  })).toString('utf8');
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const keys = head.split(',');
  return lines.map((line) => Object.fromEntries(line.split(',').map((v, i) => [keys[i], v])));
}

const num = (v) => (v === '' || v == null ? NaN : Number(v));

async function counted(select, from, where) {
  const [{ n }] = await tap(`SELECT COUNT(*) AS n FROM ${from} WHERE ${where}`);
  const rows = await tap(`SELECT ${select} FROM ${from} WHERE ${where}`);
  return { rows, complete: rows.length === Number(n) };
}

// The sync endpoint can truncate large results; halve the parallax range until each band comes back whole.
async function gaiaBand(lo, hi) {
  const { rows, complete } = await counted(
    'g.source_id, g.ra, g.dec, g.pmra, g.pmdec, g.parallax, g.parallax_over_error, g.phot_g_mean_mag, g.bp_rp, n.original_ext_source_id AS hip',
    'gaiadr3.gaia_source AS g LEFT OUTER JOIN gaiadr3.hipparcos2_best_neighbour AS n ON n.source_id = g.source_id',
    `g.parallax > ${lo}${hi ? ` AND g.parallax <= ${hi}` : ''} AND g.parallax_over_error > 10`,
  );
  if (complete) return rows;
  const mid = hi ? (lo + hi) / 2 : lo * 4;
  if (hi && hi - lo < 0.5) throw new Error(`Gaia sync result truncated even for parallax ${lo}–${hi} mas`);
  console.log(`  Gaia parallax ${lo}–${hi ?? '∞'} truncated; splitting at ${mid}`);
  return [...(await gaiaBand(lo, mid)), ...(await gaiaBand(mid, hi))];
}

const angle = (a, b) => {
  const c = Math.sin(a.dec * R) * Math.sin(b.dec * R) + Math.cos(a.dec * R) * Math.cos(b.dec * R) * Math.cos((a.ra - b.ra) * R);
  return Math.acos(Math.min(1, c)) / R;
};

function skyIndex(items) {
  const sorted = [...items].sort((a, b) => a.dec - b.dec);
  return (at, radius) => {
    let lo = 0, hi = sorted.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m].dec < at.dec - radius) lo = m + 1; else hi = m; }
    const out = [];
    for (let i = lo; i < sorted.length && sorted[i].dec <= at.dec + radius; i++) {
      const sep = angle(at, sorted[i]);
      if (sep <= radius) out.push([sorted[i], sep]);
    }
    return out;
  };
}

// Moves a catalogue position to epoch J2000; pmra is already μα·cos δ.
const toJ2000 = (ra, dec, pmra, pmdec, years) => ({
  ra: ra + (pmra * years) / 3.6e6 / Math.cos(dec * R),
  dec: dec + (pmdec * years) / 3.6e6,
});

function polyfit(xs, ys, deg) {
  const n = deg + 1;
  const a = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  xs.forEach((x, k) => {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) a[i][j] += x ** (i + j);
      a[i][n] += ys[k] * x ** i;
    }
  });
  for (let i = 0; i < n; i++) {
    const p = a.slice(i).reduce((best, row, k) => (Math.abs(row[i]) > Math.abs(a[best][i]) ? i + k : best), i);
    [a[i], a[p]] = [a[p], a[i]];
    for (let k = 0; k < n; k++) if (k !== i) { const f = a[k][i] / a[i][i]; for (let j = i; j <= n; j++) a[k][j] -= f * a[i][j]; }
  }
  return a.map((row, i) => row[n] / row[i]);
}
const poly = (c, x) => c.reduce((s, k, i) => s + k * x ** i, 0);

async function brightStars() {
  const gz = await cached('V/50/catalog.gz', async () => {
    const res = await fetch('https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz');
    if (!res.ok) throw new Error(`CDS HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  });
  const col = (line, a, b) => line.slice(a - 1, b).trim();
  const stars = [];
  for (const line of gunzipSync(gz).toString('latin1').split('\n')) {
    const v = Number(col(line, 103, 107));
    if (!col(line, 76, 77) || !Number.isFinite(v) || v > MAX_MAG) continue;
    const ra = (Number(col(line, 76, 77)) + Number(col(line, 78, 79)) / 60 + Number(col(line, 80, 83)) / 3600) * 15;
    const dec = (col(line, 84, 84) === '-' ? -1 : 1) * (Number(col(line, 85, 86)) + Number(col(line, 87, 88)) / 60 + Number(col(line, 89, 90)) / 3600);
    const bv = num(col(line, 110, 114));
    stars.push({ hr: Number(col(line, 1, 4)), ra, dec, v, bv: Number.isFinite(bv) ? bv : 0 });
  }
  return stars;
}

console.log('Yale BSC…');
const bsc = await brightStars();

console.log('Hipparcos-2 (public.hipparcos_newreduction)…');
const hip2 = await counted('hip, ra_rad, de_rad, plx, e_plx, pm_ra, pm_de, hp_mag, b_v', 'public.hipparcos_newreduction', '1 = 1');
if (!hip2.complete) throw new Error('Hipparcos-2 sync result truncated');
const hips = hip2.rows.map((r) => ({
  hip: Number(r.hip), plx: num(r.plx), eplx: num(r.e_plx), hp: num(r.hp_mag), bv: num(r.b_v),
  ...toJ2000(num(r.ra_rad) / R, num(r.de_rad) / R, num(r.pm_ra), num(r.pm_de), 8.75),
}));
const hipByNumber = new Map(hips.map((h) => [h.hip, h]));

console.log('Gaia DR3 within 100 ly…');
const gaiaSeen = new Set();
const gaia = (await gaiaBand(MIN_PLX)).filter((r) => !gaiaSeen.has(r.source_id) && gaiaSeen.add(r.source_id)).map((r) => {
  const c = num(r.bp_rp), g = num(r.phot_g_mean_mag);
  return {
    sourceId: r.source_id, hip: r.hip ? Number(r.hip) : null, plx: num(r.parallax), poe: num(r.parallax_over_error), c,
    v: Number.isFinite(c) ? g - (-0.02704 + 0.01424 * c - 0.2156 * c ** 2 + 0.01426 * c ** 3) : g + 0.5,
    ...toJ2000(num(r.ra), num(r.dec), num(r.pmra), num(r.pmdec), -16),
  };
});

// BSC → Hipparcos-2 by position and magnitude. The unbounded second pass catches Miras listed at maximum
// light and double-star secondaries that Hipparcos measured together with their primary.
const nearHip = skyIndex(hips);
const matchHip = (s, maxDv) => {
  let best = null;
  for (const [h, sep] of nearHip(s, 60 / 3600)) {
    const dv = Math.abs(s.v - h.hp);
    const score = (sep * 3600) / 20 + dv / 0.5;
    if (dv <= maxDv && (!best || score < best.score)) best = { h, score };
  }
  return best;
};
const bscByHip = new Map();
for (const s of bsc) {
  const m = matchHip(s, 1.2) ?? matchHip(s, Infinity);
  if (!m) continue;
  [s.hipRow, s.hipScore] = [m.h, m.score];
  const primary = bscByHip.get(m.h.hip);
  if (!primary || m.score < primary.hipScore) bscByHip.set(m.h.hip, s);
}

// Gaia → BSC by Hipparcos number, then by position for bright stars missing from hipparcos2_best_neighbour
// and for secondaries whose Hipparcos entry went to the primary.
const nearBsc = skyIndex(bsc);
for (const g of gaia) { const s = bscByHip.get(g.hip); if (s) { s.gaia = g; g.merged = true; } }
for (const g of gaia) {
  if (g.merged) continue;
  const [s] = nearBsc(g, 20 / 3600).filter(([b]) => !b.gaia && Math.abs(b.v - g.v) < 1).sort((a, b) => a[1] - b[1])[0] ?? [];
  if (s) { s.gaia = g; g.merged = true; }
}

// Hipparcos-2 stars within 100 ly that are neither BSC nor in Gaia's set (Gaia DR3 gave many close binaries no parallax).
const usedHip = new Set([...bsc.filter((s) => s.hipRow).map((s) => s.hipRow.hip), ...gaia.filter((g) => g.hip).map((g) => g.hip)]);
const nearGaia = skyIndex(gaia);
const hipOnly = hips.filter((h) => h.plx > MIN_PLX && h.plx / h.eplx > 10 && !usedHip.has(h.hip)
  && !nearGaia(h, 20 / 3600).some(([g]) => Math.abs(g.v - h.hp) < 1.5));
const hipV = new Map((hipOnly.length ? await tap(`SELECT hip, vmag FROM public.hipparcos WHERE hip IN (${hipOnly.map((h) => h.hip).join(',')})`) : [])
  .map((r) => [Number(r.hip), num(r.vmag)]));

// B−V from Gaia BP−RP, fitted on stars with both. BP−RP is clamped below the cubic's peak: it turns over in the
// sparse M-dwarf tail, where real B−V keeps rising.
let train = gaia.map((g) => [g.c, hipByNumber.get(g.hip)?.bv]).filter(([c, bv]) => Number.isFinite(c) && Number.isFinite(bv));
let coef = polyfit(train.map((t) => t[0]), train.map((t) => t[1]), 3);
const rms = (set) => Math.sqrt(set.reduce((s, [c, bv]) => s + (poly(coef, c) - bv) ** 2, 0) / set.length);
const clip = 3 * rms(train);
train = train.filter(([c, bv]) => Math.abs(poly(coef, c) - bv) < clip);
coef = polyfit(train.map((t) => t[0]), train.map((t) => t[1]), 3);
const cMin = Math.min(...train.map((t) => t[0])), cMax = Math.max(...train.map((t) => t[0]));
let cTop = cMin;
for (let c = cMin; c <= cMax; c += 0.01) if (poly(coef, c) > poly(coef, cTop)) cTop = c;
const bvFromGaia = (c) => (Number.isFinite(c) ? poly(coef, Math.min(cTop, Math.max(cMin, c))) : 1.5);
console.log(`B−V fit on ${train.length} Gaia×Hipparcos stars (3σ clipped): B−V = ${coef.map((k, i) => `${k >= 0 && i ? '+' : ''}${k.toFixed(5)}${i ? `·c${i > 1 ? `^${i}` : ''}` : ''}`).join(' ')}, c = BP−RP clamped to [${cMin.toFixed(2)}, ${cTop.toFixed(2)}] (B−V ${poly(coef, cMin).toFixed(2)}…${poly(coef, cTop).toFixed(2)}), rms ${rms(train).toFixed(3)} mag`);

for (const s of bsc) {
  const h = s.hipRow;
  if (s.gaia && s.gaia.poe > 10) [s.plx, s.eplx] = [s.gaia.plx, s.gaia.plx / s.gaia.poe];
  else if (h && h.plx > 0 && h.plx / h.eplx >= 3) [s.plx, s.eplx] = [h.plx, h.eplx];
}
// Components of one system share a distance: a close pair whose parallaxes agree takes the better one
// (Hipparcos-2 puts α Cen B 0.23 ly in front of A).
let shared = 0;
for (const b of bsc.filter((s) => s.plx)) {
  const [best] = nearBsc(b, 30 / 3600).map(([t]) => t)
    .filter((t) => t.plx && t.eplx < b.eplx && Math.abs(t.plx - b.plx) < 3 * Math.hypot(t.eplx, b.eplx))
    .sort((p, q) => p.eplx - q.eplx);
  if (best) { b.sharedPlx = best.plx; shared++; }
}

const entries = [];
let bscFar = 0;
for (const s of bsc) {
  const plx = s.sharedPlx ?? s.plx;
  if (!plx) bscFar++;
  const id = bscByHip.get(s.hipRow?.hip) === s ? `HIP ${s.hipRow.hip}` : s.gaia?.hip ? `HIP ${s.gaia.hip}` : `HR ${s.hr}`;
  entries.push({ ra: s.ra, dec: s.dec, ly: plx ? LY_MAS / plx : FAR_LY, v: s.v, bv: s.bv, pop: 'bsc', uncertain: !plx, id });
}
let noMag = 0;
for (const g of gaia) {
  if (g.merged) continue;
  if (!Number.isFinite(g.v)) { noMag++; continue; }
  entries.push({ ra: g.ra, dec: g.dec, ly: LY_MAS / g.plx, v: g.v, bv: bvFromGaia(g.c), pop: 'gaia', id: g.hip ? `HIP ${g.hip}` : `Gaia DR3 ${g.sourceId}` });
}
for (const h of hipOnly) {
  const v = hipV.get(h.hip);
  if (!Number.isFinite(v)) throw new Error(`HIP ${h.hip}: no V magnitude in public.hipparcos`);
  entries.push({ ra: h.ra, dec: h.dec, ly: LY_MAS / h.plx, v, bv: Number.isFinite(h.bv) ? h.bv : 1.5, pop: 'hip', id: `HIP ${h.hip}` });
}
const seenIds = new Set();
for (const e of entries) { if (seenIds.has(e.id)) throw new Error(`duplicate id ${e.id}`); seenIds.add(e.id); }
entries.sort((a, b) => a.v - b.v || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

const names = {};
const nameIndex = {};
const place = (name, i) => {
  if (names[i]) throw new Error(`${name} and ${names[i]} snapped to the same star`);
  names[i] = name;
  nameIndex[name] = i;
};
for (const [name, ra, dec] of NAMED) {
  const near = entries.flatMap((e, i) => (e.pop === 'bsc' ? [[i, angle(e, { ra, dec })]] : [])).sort((a, b) => a[1] - b[1]);
  if (near[0][1] > 0.5) throw new Error(`${name}: nearest catalogue star is ${near[0][1].toFixed(2)}° away`);
  // BSC lists both components of close doubles (ζ Ori A/B); the name goes to the brighter, i.e. lower index.
  place(name, Math.min(...near.filter(([, d]) => d < near[0][1] + 30 / 3600).map(([i]) => i)));
}
for (const [name, ra, dec, ly, v] of NEARBY) {
  let best = -1, bestScore = Infinity;
  entries.forEach((e, i) => {
    const sep = angle(e, { ra, dec });
    if (sep > 0.1 || e.uncertain || Math.abs(e.ly / ly - 1) > 0.3) return;
    const score = sep / 0.1 + Math.abs(e.v - v) / 2;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  if (best < 0) throw new Error(`${name}: no star within 0.1° of ${ra}, ${dec} at about ${ly} ly`);
  place(name, best);
}
const asterisms = ASTERISMS.map(([a, b]) => {
  if (nameIndex[a] == null || nameIndex[b] == null) throw new Error(`asterism ${a}–${b}: unnamed star`);
  return [nameIndex[a], nameIndex[b]];
});

const round = (x, d) => +x.toFixed(d);
const stars = entries.map((e) => {
  const cd = Math.cos(e.dec * R);
  return [round(e.ly * cd * Math.cos(e.ra * R), 3), round(e.ly * cd * Math.sin(e.ra * R), 3), round(e.ly * Math.sin(e.dec * R), 3), round(e.v, 2), round(e.bv, 2)];
});
mkdirSync('public/data/sky', { recursive: true });
writeFileSync(OUT, JSON.stringify({
  source: 'Gaia DR3 (ESA/Gaia/DPAC), Hipparcos-2 (van Leeuwen 2007), Yale Bright Star Catalogue 5th ed. (Hoffleit & Warren 1991). ICRS equatorial light-years from the Sun [x, y, z, Vmag, B-V].',
  generated: new Date().toISOString().slice(0, 10),
  stars, ids: entries.map((e) => e.id), names, asterisms,
  uncertain: entries.flatMap((e, i) => (e.uncertain ? [i] : [])),
}));

const merged = gaia.filter((g) => g.merged).length;
const count = (pop) => entries.filter((e) => e.pop === pop).length;
console.log(`${OUT}: ${entries.length} stars, ${(statSync(OUT).size / 1024).toFixed(0)} KB`);
console.log(`  BSC ${count('bsc')}: ${bsc.filter((s) => s.hipRow).length} matched to Hipparcos-2 (${bsc.filter((s) => s.hipRow && bscByHip.get(s.hipRow.hip) !== s).length} sharing a primary's entry), ${bsc.filter((s) => s.gaia).length} placed by Gaia, ${shared} by a companion's parallax, ${bscFar} at ${FAR_LY} ly`);
console.log(`  Gaia ${gaia.length} within 100 ly: ${merged} merged into BSC stars, ${count('gaia')} Gaia-only, ${noMag} dropped for having no G magnitude; Hipparcos-only ${count('hip')}`);
console.log(`  BSC without Hipparcos-2: ${bsc.filter((s) => !s.hipRow).map((s) => `HR ${s.hr} V${s.v}`).join(', ') || 'none'}`);
for (const name of VERIFY) {
  const i = nameIndex[name], e = entries[i];
  console.log(`  ${name.padEnd(17)} #${String(i).padEnd(5)} ${e.id.padEnd(30)} ${e.ly.toFixed(2).padStart(8)} ly  V ${e.v.toFixed(2)}`);
}
const bright = entries.filter((e) => e.pop !== 'bsc' && e.v < MAX_MAG);
console.log(`  non-BSC stars brighter than V ${MAX_MAG}: ${bright.map((e) => `${e.id} V${e.v.toFixed(2)}`).join(', ') || 'none'}`);
const byLy = [...entries].sort((a, b) => a.ly - b.ly);
const close = { same: 0, cross: 0 };
for (let k = 0; k < byLy.length; k++) {
  for (let m = k + 1; m < byLy.length && byLy[m].ly - byLy[k].ly < 0.01; m++) {
    if (angle(byLy[k], byLy[m]) < 0.05) close[byLy[k].pop === byLy[m].pop ? 'same' : 'cross']++;
  }
}
// One star twice can only come from two catalogues; close pairs within one catalogue are distinct entries (binaries).
const nearEntry = skyIndex(entries);
const dupes = entries.flatMap((a) => nearEntry(a, 10 / 3600)
  .filter(([b]) => b.pop > a.pop && Math.abs(b.v - a.v) < 1)
  .map(([b, sep]) => `${a.id} V${a.v.toFixed(2)} ${a.ly.toFixed(2)} ly / ${b.id} V${b.v.toFixed(2)} ${b.ly.toFixed(2)} ly, ${(sep * 3600).toFixed(1)}″`));
console.log(`  pairs within 0.01 ly and 0.05°: ${close.same} inside one catalogue, ${close.cross} across catalogues`);
console.log(`  cross-catalogue pairs within 10″ and 1 mag: ${dupes.length}${dupes.length ? `\n    ${dupes.join('\n    ')}` : ''}`);

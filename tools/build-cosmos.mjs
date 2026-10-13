// Builds public/data/cosmos/{local-galaxies.bin, deep-galaxies.bin, cosmos.json}, the galaxies the space view draws
// past the Milky Way. Local: every galaxy of the 2MASS Redshift Survey (Huchra et al. 2012, ApJS 199, 26; CDS
// J/ApJS/199/26 table3, FTP). Deep: SDSS DR17 spectroscopic galaxies (0.01 < z < 0.7) and quasars (z < 6) from the
// SkyServer SQL search, thinned evenly by specObjID. Structures: NED preferred positions and redshifts for clusters
// (Virgo from SIMBAD), literature centres for voids and walls.
// Points are J2000 equatorial Cartesian in millions of light-years (x → RA 0 Dec 0, y → RA 90°, z → Dec +90°) at the
// comoving distance of the heliocentric redshift, flat ΛCDM Planck 2018. Each .bin is Float32LE, 4 per object:
//   local [x, y, z, absolute Ks mag]   deep [x, y, z, redshift] with redshift negative for quasars, galaxies first
//   nice node tools/build-cosmos.mjs [cache-dir]   (keeps raw downloads there for offline rebuilds)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const DIR = 'public/data/cosmos';
const TWOMRS = 'https://cdsarc.cds.unistra.fr/ftp/J/ApJS/199/26/table3.dat.gz';
const SKYSERVER = 'https://skyserver.sdss.org/dr17/SkyServerWS/SearchTools/SqlSearch';
const CACHE = process.argv[2];
const R = Math.PI / 180;
const C = 299792.458;
const H0 = 67.66, OM = 0.3111, OR = 9.1e-5, OL = 1 - OM - OR;
const HUBBLE_MLY = (C / H0) * 3.261564;
const MIN_CZ = 300;

// Thinned by specObjID modulus: its packed plate/fibre/MJD bits spread each residue evenly over sky and redshift.
const DEEP = [
  ['galaxies', "class = 'GALAXY' AND zWarning = 0 AND z > 0.01 AND z < 0.7 AND specObjID % 13 = 0", 1],
  ['quasars', "class = 'QSO' AND zWarning = 0 AND z > 0 AND z < 6 AND specObjID % 25 < 4", -1],
];

// [name, ra°, dec° (J2000), heliocentric z]. NED's Virgo z (0.00436) sits behind the 2MRS members (median 1172 km/s),
// so Virgo takes SIMBAD's. Pisces–Perseus is placed on Abell 262, the CfA2 Great Wall on Coma, the Sloan Great Wall on
// SCl 019 (184+003+007 at 230.4 h⁻¹ Mpc, Einasto et al. 2016), the Boötes Void at Kirshner et al. 1987 (15,500 km/s),
// the Local Void at Tully et al. 2008 (≥ 23 Mpc).
const STRUCTURES = [
  ['Virgo Cluster', 187.6991, 12.3852, 0.0038],
  ['Fornax Cluster', 54.6208, -35.4503, 0.004753],
  ['Centaurus Cluster', 192.2039, -41.3117, 0.01041],
  ['Norma Cluster (Great Attractor)', 243.6032, -60.8669, 0.016248],
  ['Hydra Cluster', 159.1780, -27.5286, 0.012389],
  ['Perseus Cluster', 49.9532, 41.5115, 0.017195],
  ['Coma Cluster', 194.953, 27.981, 0.023997],
  ['Leo Cluster (Abell 1367)', 176.1561, 19.7625, 0.021888],
  ['Hercules Cluster', 241.3121, 17.7429, 0.036482],
  ['Shapley Supercluster', 201.9896, -31.5025, 0.048367],
  ['Pisces–Perseus Supercluster', 28.1938, 36.1519, 0.016211],
  ['CfA2 Great Wall', 194.953, 27.981, 0.023997],
  ['Sloan Great Wall', 184, 3, 0.078],
  ['Boötes Void', 222.9458, 45.7955, 0.0517],
  ['Local Void', 279.5, 18.0, 0.0052],
];

async function cached(key, load) {
  const file = CACHE && `${CACHE}/${createHash('sha1').update(key).digest('hex').slice(0, 16)}`;
  if (file && existsSync(file)) return readFileSync(file);
  const data = await load();
  if (file) { mkdirSync(CACHE, { recursive: true }); writeFileSync(file, data); }
  return data;
}

// SkyServer drops connections and answers 503 now and then.
async function retry(load, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await load(); } catch (e) {
      if (i === tries) throw e;
      console.log(`  ${e.message.slice(0, 160)}; retrying in ${20 * i}s`);
      await new Promise((r) => setTimeout(r, 20000 * i));
    }
  }
}

async function sql(cmd) {
  const text = (await cached(cmd, () => retry(async () => {
    const res = await fetch(`${SKYSERVER}?${new URLSearchParams({ cmd, format: 'csv' })}`, { signal: AbortSignal.timeout(300000) });
    const body = await res.text();
    if (!res.ok || !body.startsWith('#Table1')) throw new Error(`SkyServer HTTP ${res.status}: ${body.slice(0, 300)}`);
    return body;
  }))).toString('utf8');
  const [, head, ...lines] = text.trim().split(/\r?\n/);
  const keys = head.split(',');
  return lines.map((line) => Object.fromEntries(line.split(',').map((v, i) => [keys[i], v])));
}

// The search caps rows per query; halve the RA band until it comes back whole.
async function sdssBand(where, lo, hi) {
  const range = `${where} AND ra >= ${lo} AND ra < ${hi}`;
  const [{ n }] = await sql(`SELECT COUNT(*) AS n FROM SpecObj WHERE ${range}`);
  const rows = await sql(`SELECT ra, dec, z FROM SpecObj WHERE ${range}`);
  if (rows.length === Number(n)) return rows;
  if (hi - lo < 1) throw new Error(`SkyServer result truncated even for RA ${lo}–${hi}`);
  console.log(`  RA ${lo}–${hi}: ${rows.length} of ${n} rows; splitting`);
  return [...(await sdssBand(where, lo, (lo + hi) / 2)), ...(await sdssBand(where, (lo + hi) / 2, hi))];
}

// χ = c/H0 ∫ da / √(Ωr + Ωm a + ΩΛ a⁴) over [1/(1+z), 1]; in a the integrand stays finite down to a = 0.
function comovingFromA(a0, n = 200000) {
  const f = (a) => 1 / Math.sqrt(OR + OM * a + OL * a ** 4);
  const h = (1 - a0) / n;
  let s = f(a0) + f(1);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a0 + i * h);
  return (HUBBLE_MLY * s * h) / 3;
}

const Z_MAX = 6, Z_STEPS = 60000;
const E = (z) => Math.sqrt(OR * (1 + z) ** 4 + OM * (1 + z) ** 3 + OL);
const chiTable = new Float64Array(Z_STEPS + 1);
for (let i = 1, h = Z_MAX / Z_STEPS; i <= Z_STEPS; i++) {
  const z0 = (i - 1) * h;
  chiTable[i] = chiTable[i - 1] + ((HUBBLE_MLY * h) / 6) * (1 / E(z0) + 4 / E(z0 + h / 2) + 1 / E(z0 + h));
}
function comovingMly(z) {
  const f = (z / Z_MAX) * Z_STEPS, i = Math.min(Math.floor(f), Z_STEPS - 1);
  return chiTable[i] + (f - i) * (chiTable[i + 1] - chiTable[i]);
}

const xyz = (ra, dec, r) => {
  const cd = Math.cos(dec * R);
  return [r * cd * Math.cos(ra * R), r * cd * Math.sin(ra * R), r * Math.sin(dec * R)];
};

function writeBin(file, rows) {
  const buf = Buffer.alloc(rows.length * 16);
  rows.forEach((row, i) => row.forEach((v, k) => buf.writeFloatLE(v, i * 16 + k * 4)));
  writeFileSync(`${DIR}/${file}`, buf);
  return buf;
}

const readBin = (buf) => Array.from({ length: buf.length / 16 }, (_, i) => [0, 1, 2, 3].map((k) => buf.readFloatLE(i * 16 + k * 4)));

console.log('2MRS (CDS J/ApJS/199/26 table3)…');
const gz = await cached(TWOMRS, () => retry(async () => {
  const res = await fetch(TWOMRS, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`CDS HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}));
const col = (line, a, b) => line.slice(a - 1, b).trim();
const lines = gunzipSync(gz).toString('latin1').split('\n').filter((l) => l.trim());
let noCz = 0;
const local = [];
for (const line of lines) {
  if (!col(line, 174, 178)) { noCz++; continue; }
  const cz = Number(col(line, 174, 178));
  if (cz < MIN_CZ) continue;
  const z = cz / C, mly = comovingMly(z);
  // Total extrapolated Ks (Ktmag) at the luminosity distance; no K-correction (≲ 0.25 mag out to the survey's z ≈ 0.1).
  const absK = Number(col(line, 79, 84)) - 5 * Math.log10(((1 + z) * mly) / 3.261564) - 25;
  local.push({ ra: Number(col(line, 18, 26)), dec: Number(col(line, 28, 36)), cz, mly, absK });
}
const localBuf = writeBin('local-galaxies.bin', local.map((g) => [...xyz(g.ra, g.dec, g.mly), g.absK]));

const deep = {};
for (const [label, where, sign] of DEEP) {
  console.log(`SDSS DR17 ${label}…`);
  deep[label] = [];
  for (let lo = 0; lo < 360; lo += 60) deep[label].push(...(await sdssBand(where, lo, lo + 60)));
  deep[label] = deep[label].map((r) => {
    const z = Number(r.z);
    return [...xyz(Number(r.ra), Number(r.dec), comovingMly(z)), sign * z];
  });
}
const deepBuf = writeBin('deep-galaxies.bin', [...deep.galaxies, ...deep.quasars]);

const structures = STRUCTURES.map(([name, ra, dec, z]) => ({ name, ra, dec, z, mly: Math.round(comovingMly(z)) }));
const horizon = { cmbMly: Math.round(comovingFromA(1 / 1091)), particleMly: Math.round(comovingFromA(0)) };
writeFileSync(`${DIR}/cosmos.json`, `${JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  cosmology: 'flat ΛCDM, H0 67.66, Ωm 0.3111, Ωr 9.1e-5 (Planck 2018); comoving distances of heliocentric redshifts',
  local: {
    file: 'local-galaxies.bin', count: local.length, format: 'Float32LE x, y, z (Mly, J2000 equatorial), absolute Ks mag',
    source: `2MASS Redshift Survey (Huchra et al. 2012, ApJS 199, 26; CDS J/ApJS/199/26): every galaxy with Ks ≤ 11.75 and heliocentric cz ≥ ${MIN_CZ} km/s; absolute magnitude from the total Ks (Ktmag)`,
    credit: '2MASS Redshift Survey, Huchra et al. 2012, ApJS 199, 26. 2MASS is a joint project of the University of Massachusetts and IPAC/Caltech, funded by NASA and the NSF.',
  },
  deep: {
    file: 'deep-galaxies.bin', count: deep.galaxies.length + deep.quasars.length, galaxies: deep.galaxies.length, quasars: deep.quasars.length,
    format: 'Float32LE x, y, z (Mly, J2000 equatorial), redshift (negative for quasars); galaxies first, then quasars',
    source: 'SDSS DR17 SpecObj via SkyServer SQL search: galaxies with zWarning = 0 and 0.01 < z < 0.7 (1 in 13 by specObjID), quasars with zWarning = 0 and z < 6 (4 in 25 by specObjID)',
    credit: "Sloan Digital Sky Survey DR17 (Abdurro'uf et al. 2022, ApJS 259, 35). Funding for the SDSS has been provided by the Alfred P. Sloan Foundation, the U.S. Department of Energy Office of Science, the National Science Foundation, and the Participating Institutions. www.sdss.org",
  },
  structures,
  horizon,
}, null, 2)}\n`);

const kb = (file) => `${(statSync(`${DIR}/${file}`).size / 1024).toFixed(0)} KB`;
console.log(`${DIR}/local-galaxies.bin: ${local.length} of ${lines.length} 2MRS galaxies (${noCz} without cz, ${lines.length - noCz - local.length} below ${MIN_CZ} km/s), ${kb('local-galaxies.bin')}`);
console.log(`${DIR}/deep-galaxies.bin: ${deep.galaxies.length} galaxies + ${deep.quasars.length} quasars, ${kb('deep-galaxies.bin')}`);
console.log(`  χ(z = 6) table ${comovingMly(6).toFixed(1)} vs direct ${comovingFromA(1 / 7).toFixed(1)} Mly; CMB ${horizon.cmbMly} Mly, particle horizon ${horizon.particleMly} Mly`);
const absK = local.map((g) => g.absK).sort((a, b) => a - b);
console.log(`  absolute Ks: 1% ${absK[Math.floor(absK.length * 0.01)].toFixed(2)}, median ${absK[absK.length >> 1].toFixed(2)}, 99% ${absK[Math.floor(absK.length * 0.99)].toFixed(2)}`);

// Checks read the written files back, so they test the axis convention, not just the inputs.
const unit = (ra, dec) => xyz(ra, dec, 1);
const capProfile = (points, ra, dec, radius, bin, bins) => {
  const u = unit(ra, dec), hist = new Array(bins).fill(0), cosR = Math.cos(radius * R);
  for (const [x, y, z] of points) {
    const r = Math.hypot(x, y, z);
    if ((x * u[0] + y * u[1] + z * u[2]) / r >= cosR && r < bin * bins) hist[Math.floor(r / bin)]++;
  }
  return hist;
};
const localPts = readBin(localBuf);
const virgo = capProfile(localPts, 187.7, 12.4, 10, 5, 30);
console.log(`  2MRS within 10° of Virgo (187.7°, 12.4°) per 5 Mly, 0–150: ${virgo.join(' ')}`);
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const sample = [];
while (sample.length < 200) {
  const ra = rand() * 360, dec = Math.asin(2 * rand() - 1) / R;
  const [x, y, z] = unit(ra, dec);
  // Galactic latitude from the J2000 north galactic pole (192.85948°, 27.12825°); keep clear of the Zone of Avoidance.
  if (Math.abs(Math.asin(x * Math.cos(27.12825 * R) * Math.cos(192.85948 * R) + y * Math.cos(27.12825 * R) * Math.sin(192.85948 * R) + z * Math.sin(27.12825 * R)) / R) < 20) continue;
  sample.push(capProfile(localPts, ra, dec, 10, 5, 30));
}
const band = (hist, lo, hi) => hist.slice(lo / 5, hi / 5).reduce((s, n) => s + n, 0);
const randomBand = sample.map((h) => band(h, 40, 80)).sort((a, b) => a - b);
console.log(`  40–80 Mly within 10°: Virgo ${band(virgo, 40, 80)}, 200 random directions at |b| > 20° median ${randomBand[100]}, 90th percentile ${randomBand[180]}`);

// Density contrast inside 20 Mly of each structure against its distance shell, from the 2MRS file.
const radii = localPts.map(([x, y, z]) => Math.hypot(x, y, z));
for (const s of structures.filter((t) => t.z < 0.06)) {
  const c = xyz(s.ra, s.dec, s.mly);
  const inside = localPts.filter(([x, y, z]) => Math.hypot(x - c[0], y - c[1], z - c[2]) < 20).length;
  const shell = radii.filter((r) => Math.abs(r - s.mly) < 20).length;
  const expected = (shell * (4 / 3) * Math.PI * 20 ** 3) / ((4 / 3) * Math.PI * ((s.mly + 20) ** 3 - Math.max(0, s.mly - 20) ** 3));
  const members = local.filter((g) => Math.acos(Math.min(1, unit(g.ra, g.dec).reduce((sum, v, k) => sum + v * unit(s.ra, s.dec)[k], 0))) / R < 1.5
    && Math.abs(g.cz - s.z * C) < 1500).map((g) => g.cz).sort((a, b) => a - b);
  console.log(`  ${s.name.padEnd(32)} z ${s.z.toFixed(4)} ${String(s.mly).padStart(5)} Mly  δ+1 = ${(inside / expected).toFixed(2).padStart(5)}  2MRS within 1.5°, ±1500 km/s: ${members.length}, median cz ${members[members.length >> 1] ?? '–'} vs ${Math.round(s.z * C)}`);
}
// SDSS's selection varies with distance, so the wall shows against the footprint-wide profile, not in raw counts.
const sgw = structures.find((s) => s.name === 'Sloan Great Wall');
const deepGalaxies = readBin(deepBuf).filter((p) => p[3] > 0);
const sgwCap = capProfile(deepGalaxies, sgw.ra, sgw.dec, 10, 50, 30), footprint = capProfile(deepGalaxies, 0, 90, 180, 50, 30);
const ratio = (k) => (sgwCap[k] / sgwCap.reduce((s, n) => s + n, 0)) / (footprint[k] / footprint.reduce((s, n) => s + n, 0) || 1);
console.log(`  SDSS galaxies within 10° of the Sloan Great Wall anchor (${sgw.mly} Mly) over the footprint average, per 50 Mly from 600: ${sgwCap.slice(12).map((_, k) => ratio(k + 12).toFixed(2)).join(' ')}`);

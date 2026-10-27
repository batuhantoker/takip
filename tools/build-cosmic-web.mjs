// Builds public/data/cosmos/web.bin, the cosmic web the space view draws around the galaxies:
//   - voids: Douglass et al. 2023 (CDS J/ApJS/265/7, table 3), the V2/VIDE voids of SDSS DR7 for Planck 2018, each as
//     its fitted ellipsoid (centre and three axis vectors);
//   - all-sky voids near us: Einasto et al. 1994 (CDS J/MNRAS/269/301, table 5), the voids between the rich clusters of
//     the supercluster network, B1950, drawn as spheres across their smallest axis;
//   - supervoids far out: Arsenov et al. 2025 (CDS J/A+A/706/A362), ZOBOV voids among the Gaia Quaia quasars at redshift
//     0.8–2.3, all sky; the clear ones only (density ratio over 1.2, off the survey edge), as spheres of their volume;
//   - the 25 nearest voids: Pustilnik et al. 2019 (CDS J/MNRAS/482/4329, table 1), within 25 Mpc over the whole sky,
//     as ellipsoids spanning their extents along the supergalactic axes; their distances are D = V/73;
//   - superclusters: Liivamägi et al. 2012 (CDS J/A+A/539/A80, adaptive threshold), SDSS DR7, the ones over
//     30 h⁻¹ Mpc across, written to public/data/cosmos/superclusters.json as [x, y, z, radius (Mly), galaxies];
//   - filaments: Tempel et al. 2014 (CDS J/MNRAS/438/3465, table 2), 15,421 filament spines traced through SDSS DR8 by
//     the Bisous model, each as its run of points.
// It also writes public/data/cosmos/basins.bin and src/lib/space/deep/basins.generated.ts: the gravitational basins of
// Dupuy & Courtois 2023 (A&A 678, A176), watersheds of the Cosmicflows-4 galaxy velocity field on a 128³ grid 1000 h⁻¹ Mpc
// across, supergalactic, indexed [z][y][x]. Laniakea and its five neighbours (basins of attraction 1–6) and the Sculptor
// Void (basin of repulsion 1) are meshed by surface nets around each basin's blurred voxels. The grids came from
// projets.ip2i.in2p3.fr/cosmicflows, unreachable when this was written; the Wayback copy of the zip is used. Through
// each basin run streamlines of the same reconstruction's velocity field (Courtois et al. 2023, on Zenodo), from a
// spread of its voxels to the attractor, or out from the repeller. That cube is stored [component][x][y][z], the
// other way round from the basins: read so, 99% of streamlines end in their own basin, under no other order 33%.
// All are in h⁻¹ Mpc, comoving. They are turned into J2000 equatorial millions of light-years with the h of
// tools/build-cosmos.mjs (Planck 2018), so they sit on the galaxies drawn from it. Tempel's axes are the SDSS survey
// ones: x toward RA 95°, Dec 0, and y, z turned 32.5° about x from the equator.
//   nice node tools/build-cosmic-web.mjs [cache-dir]
// web.bin, little-endian: u32 voids, u32 filaments, u32 points, f32 Mly per point unit; voids × 13 f32 (centre xyz,
// three axes xyz, Mly; catalogue: 0 Douglass, 1 Einasto, 2 Quaia, 3 Pustilnik); filaments × u16 point counts (padded to
// 4 bytes); points × 3 i16, a tenth of a million light-years apart at most, half the size of floats.
// basins.bin: u32 basins; per basin u32 vertices, u32 triangles; then each basin's vertices × 3 f32 (Mly) and
// triangles × 3 u32, in the order of BASINS; then u32 streamlines, each u16 basin and u16 points, and their points
// × 3 f32 (Mly), in the direction matter moves.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'public/data/cosmos/web.bin';
const OUT_SCL = 'public/data/cosmos/superclusters.json';
const OUT_BASINS = 'public/data/cosmos/basins.bin';
const OUT_BASINS_TS = 'src/lib/space/deep/basins.generated.ts';
const CF4_ZIP = 'https://web.archive.org/web/20231004002100id_/https://projets.ip2i.in2p3.fr//cosmicflows/CF4_new_128-z008_watersheds-fits.zip';
const CF4_VELOCITY = 'https://zenodo.org/records/20653238/files/CF4_new_128-z008_velocity.fits?download=1';
const VIZIER = 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv';
const H = 0.6766;
const MLY_PER_HMPC = 3.261564 / H;
const CACHE = process.argv[2];
const R = Math.PI / 180;
const OM = 0.3111, OR = 9.1e-5, OL = 1 - OM - OR;
const HUBBLE_HMPC = 2997.92458;

/** Comoving distance, h⁻¹ Mpc, flat ΛCDM as tools/build-cosmos.mjs. */
function comovingHMpc(z) {
  const n = 2000;
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const zi = (z * i) / n, a = 1 + zi;
    const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    sum += w / Math.sqrt(OM * a ** 3 + OR * a ** 4 + OL);
  }
  return HUBBLE_HMPC * sum * (z / n) / 3;
}

// IAU B1950 → J2000 for directions (Standish 1982).
const B1950_TO_J2000 = [[0.9999256782, -0.0111820611, -0.0048579477], [0.0111820610, 0.9999374784, -0.0000271765], [0.0048579479, -0.0000271474, 0.9999881997]];
const unit = (ra, dec) => [Math.cos(dec * R) * Math.cos(ra * R), Math.cos(dec * R) * Math.sin(ra * R), Math.sin(dec * R)];
const sphere = (centre, r, source) => [...centre, r, 0, 0, 0, r, 0, 0, 0, r, source];
const apply = (m, v) => m.map(row => row.reduce((s, x, i) => s + x * v[i], 0));

// Supergalactic → J2000 equatorial: the SG pole is at galactic l 47.37°, b 6.32°, SGX toward l 137.37°, b 0.
const GAL_TO_EQ = [[-0.0548755604, 0.4941094279, -0.8676661490], [-0.8734370902, -0.4448296300, -0.1980763734], [-0.4838350155, 0.7469822445, 0.4559837762]];
const SG_TO_EQ = (() => {
  const gal = (l, b) => [Math.cos(b * R) * Math.cos(l * R), Math.cos(b * R) * Math.sin(l * R), Math.sin(b * R)];
  const x = gal(137.37, 0), z = gal(47.37, 6.32), y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const cols = [x, y, z].map(v => apply(GAL_TO_EQ, v));
  return [0, 1, 2].map(r => cols.map(c => c[r]));
})();

async function tsv(source, columns, filter = {}) {
  const qs = new URLSearchParams({ '-source': source, '-out': columns.join(','), '-out.max': 'unlimited', ...filter });
  const key = qs.toString();
  const file = CACHE && `${CACHE}/${createHash('sha1').update(key).digest('hex').slice(0, 16)}.tsv`;
  let text;
  if (file && existsSync(file)) text = readFileSync(file, 'utf8');
  else {
    const res = await fetch(`${VIZIER}?${qs}`, { headers: { 'user-agent': 'takip-build (hello@takip.dev)' } });
    if (!res.ok) throw new Error(`VizieR ${source} HTTP ${res.status}`);
    text = await res.text();
    if (file) { mkdirSync(CACHE, { recursive: true }); writeFileSync(file, text); }
  }
  // Data rows are the tab-separated lines after the units and dashes lines that follow the header.
  const lines = text.split('\n').filter(l => l && !l.startsWith('#'));
  const header = lines.findIndex(l => l.split('\t')[0].trim() === columns[0]);
  return lines.slice(header + 3).map(l => l.split('\t').map(v => v.trim())).filter(r => r.length === columns.length && r.every(v => v !== ''));
}

// Survey axes to equatorial: undo the 32.5° turn about x, then the 95° turn in RA.
function surveyToEquatorial([x, y, z]) {
  const c = Math.cos(32.5 * R), s = Math.sin(32.5 * R);
  const [x1, y1, z1] = [x, y * c - z * s, y * s + z * c];
  const ca = Math.cos(95 * R), sa = Math.sin(95 * R);
  return [x1 * ca - y1 * sa, x1 * sa + y1 * ca, z1];
}

const voidRows = await tsv('J/ApJS/265/7/table3', ['x', 'y', 'Z', 'x1', 'y1', 'z1', 'x2', 'y2', 'z2', 'x3', 'y3', 'z3', 'Cosmo', 'Prune'], { Cosmo: 'Planck2018', Prune: 'VIDE' });
const voids = voidRows.map(r => [...r.slice(0, 12).map(Number).map(v => v * MLY_PER_HMPC), 0]);

for (const [ra, dec, dist, diam] of (await tsv('J/MNRAS/269/301/table5', ['RAB1950', 'DEB1950', 'Dist', 'Diam'])).map(r => r.map(Number))) {
  const d = B1950_TO_J2000.map(row => row.reduce((s, m, i) => s + m * unit(ra, dec)[i], 0));
  voids.push(sphere(d.map(v => v * dist * MLY_PER_HMPC), (diam / 2) * MLY_PER_HMPC, 1));
}

const quaia = await tsv('J/A+A/706/A362/voids', ['RABdeg', 'DEBdeg', 'zB', 'ReffMPC', 'DensRatio', 'EdgeFlag']);
for (const [ra, dec, z, reff, ratio, edge] of quaia.map(r => r.map(Number))) {
  if (edge !== 0 || ratio <= 1.2) continue;
  voids.push(sphere(unit(ra, dec).map(v => v * comovingHMpc(z) * MLY_PER_HMPC), reff * MLY_PER_HMPC, 2));
}

// Pustilnik's distances are physical Mpc for H0 = 73; ×0.73 gives the h⁻¹ Mpc the other catalogues use.
const nearby = (await tsv('J/MNRAS/482/4329/table1', ['Void', 'Name', 'RAJ2000', 'DEJ2000', 'Dist', 'Ext.X', 'Ext.Y', 'Ext.Z', 'NGal.tot']))
  .map(([n, name, ...rest]) => [+n, name, ...rest.map(Number)]);
if (nearby.length !== 25 || nearby.some(([n], i) => n !== i + 1)) throw new Error(`Pustilnik voids: expected 1–25 in order, got ${nearby.length}`);
for (const [, , ra, dec, dist, ...ext] of nearby) {
  const axes = [0, 1, 2].map(a => SG_TO_EQ.map(row => row[a] * (ext[a] / 2) * 0.73 * MLY_PER_HMPC));
  voids.push([...unit(ra, dec).map(v => v * dist * 0.73 * MLY_PER_HMPC), ...axes.flat(), 3]);
}

const pointRows = await tsv('J/MNRAS/438/3465/table2', ['ID', 'IDpt', 'x', 'y', 'z']);
pointRows.sort((a, b) => +a[0] - +b[0] || +a[1] - +b[1]);
const counts = [];
const points = [];
let last = null;
for (const [id, , x, y, z] of pointRows) {
  if (id !== last) { counts.push(0); last = id; }
  counts[counts.length - 1]++;
  points.push(...surveyToEquatorial([+x, +y, +z]).map(v => v * MLY_PER_HMPC));
}

// Dupuy & Courtois 2023, table 1: each basin's attractor (repeller), supergalactic h⁻¹ Mpc. A frame or axis slip would
// put one outside its own basin.
const BASINS = [
  { id: 'laniakea', grid: 'BoA', label: 1, core: [-62, -8, 39], radec: [263, -39] },
  { id: 'basin-apus', grid: 'BoA', label: 2, core: [-125, -23, -31], radec: [199, -75] },
  { id: 'basin-hercules', grid: 'BoA', label: 3, core: [-39, 70, 78], radec: [237, 9] },
  { id: 'basin-lepus', grid: 'BoA', label: 4, core: [-62, -39, -109], radec: [99, -49] },
  { id: 'basin-perseus-pisces', grid: 'BoA', label: 5, core: [47, -23, -31], radec: [56, 21] },
  { id: 'basin-shapley', grid: 'BoA', label: 6, core: [-141, 62, -16], radec: [199, -40] },
  { id: 'sculptor-void', grid: 'BoR', label: 1, core: [23, -109, -16], radec: [18, -16] },
];
const N = 128, VOX = 1000 / N;

/** The FITS files of the zip, which stores them uncompressed. */
async function cf4Grids() {
  const file = CACHE && `${CACHE}/CF4_new_128-z008_watersheds-fits.zip`;
  let zip;
  if (file && existsSync(file)) zip = readFileSync(file);
  else {
    const res = await fetch(CF4_ZIP, { headers: { 'user-agent': 'takip-build (hello@takip.dev)' } });
    if (!res.ok) throw new Error(`CF4 basins HTTP ${res.status}`);
    zip = Buffer.from(await res.arrayBuffer());
    if (file) { mkdirSync(CACHE, { recursive: true }); writeFileSync(file, zip); }
  }
  const grids = {};
  for (let o = 0; zip.readUInt32LE(o) === 0x04034b50;) {
    const size = zip.readUInt32LE(o + 18), nameLen = zip.readUInt16LE(o + 26), extra = zip.readUInt16LE(o + 28);
    const name = zip.toString('utf8', o + 30, o + 30 + nameLen), data = o + 30 + nameLen + extra;
    if (zip.readUInt16LE(o + 8) !== 0) throw new Error(`${name} is compressed`);
    // One 2880-byte header block, then BITPIX −64 big-endian doubles.
    const labels = new Uint8Array(N ** 3);
    for (let i = 0; i < N ** 3; i++) labels[i] = zip.readDoubleBE(data + 2880 + i * 8);
    grids[name.replace('CF4_new_128-z008_', '').replace('.fits', '')] = labels;
    o = data + size;
  }
  return grids;
}

/** The velocity cube, [component][x][y][z] big-endian floats after one header block. */
async function cf4Velocity() {
  const file = CACHE && `${CACHE}/CF4_new_128-z008_velocity.fits`;
  let fits;
  if (file && existsSync(file)) fits = readFileSync(file);
  else {
    const res = await fetch(CF4_VELOCITY, { headers: { 'user-agent': 'takip-build (hello@takip.dev)' } });
    if (!res.ok) throw new Error(`CF4 velocity HTTP ${res.status}`);
    fits = Buffer.from(await res.arrayBuffer());
    if (file) { mkdirSync(CACHE, { recursive: true }); writeFileSync(file, fits); }
  }
  const v = new Float32Array(3 * N ** 3);
  for (let i = 0; i < v.length; i++) v[i] = fits.readFloatBE(2880 + i * 4);
  return v;
}

/** Trilinear velocity at p, in voxel units with voxel centres on the integers. */
function velocityAt(v, p) {
  const q = p.map(c => Math.min(Math.max(c, 0), N - 1.001)), i = q.map(Math.floor), f = q.map((c, a) => c - i[a]);
  const out = [0, 0, 0];
  for (let k = 0; k < 8; k++) {
    const d = [k & 1, (k >> 1) & 1, (k >> 2) & 1];
    const w = d.reduce((m, bit, a) => m * (bit ? f[a] : 1 - f[a]), 1);
    const [x, y, z] = d.map((bit, a) => i[a] + bit);
    for (let c = 0; c < 3; c++) out[c] += w * v[((c * N + x) * N + y) * N + z];
  }
  return out;
}

/**
 * Streamlines from a spread of the basin's voxels, half a voxel a step (midpoint rule), to its core: forward for an
 * attractor; back for a repeller, then reversed, so each runs the way matter moves.
 */
function streamlines(v, keep, core, sign, cap, seed) {
  const seeds = [];
  for (let i = 0; i < N ** 3; i++) {
    const x = i % N, y = Math.floor(i / N) % N, z = Math.floor(i / N ** 2);
    if (keep[i] && x % 2 === 0 && y % 2 === 0 && z % 2 === 0) seeds.push([x, y, z]);
  }
  // A fixed shuffle, so a rebuild draws the same lines.
  let r = seed;
  const rand = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = seeds.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [seeds[i], seeds[j]] = [seeds[j], seeds[i]]; }
  const goal = core.map(c => (c + 500) / VOX - 0.5), dir = p => { const w = velocityAt(v, p), s = Math.hypot(...w) || 1; return w.map(c => (sign * c) / s); };
  const lines = [];
  let reached = 0;
  for (const s of seeds.slice(0, cap)) {
    let p = s.slice();
    const pts = [p];
    for (let step = 0; step < 260; step++) {
      const mid = p.map((c, a) => c + 0.25 * dir(p)[a]);
      p = p.map((c, a) => c + 0.5 * dir(mid)[a]);
      const q = p.map(Math.round);
      if (q.some(c => c < 0 || c >= N) || !at(keep, q)) break;
      pts.push(p);
      // Circling the sink.
      if (pts.length > 14 && Math.hypot(...p.map((c, a) => c - pts[pts.length - 13][a])) < 1.2) break;
    }
    // The flow's sink lies a voxel or two from the paper's tabulated attractor.
    if (Math.hypot(...p.map((c, a) => c - goal[a])) < 3.5) reached++;
    const kept = pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1);
    if (kept.length >= 4) lines.push(sign > 0 ? kept : kept.reverse());
  }
  return { lines, reached: reached / Math.min(cap, seeds.length) };
}

const voxelOf = sg => sg.map(v => Math.floor((v + 500) / VOX));
const at = (labels, [x, y, z]) => labels[(z * N + y) * N + x];

/** The basin's voxels joined to its attractor's; the watershed leaves a few specks of a voxel or two elsewhere. */
function basinVoxels(labels, label, core) {
  const keep = new Uint8Array(N ** 3), start = voxelOf(core), stack = [(start[2] * N + start[1]) * N + start[0]];
  keep[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop(), x = i % N, y = Math.floor(i / N) % N, z = Math.floor(i / N ** 2);
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const p = [x + dx, y + dy, z + dz];
      if (p.some(v => v < 0 || v >= N)) continue;
      const j = (p[2] * N + p[1]) * N + p[0];
      if (!keep[j] && labels[j] === label) { keep[j] = 1; stack.push(j); }
    }
  }
  return keep;
}

/** Two passes of a [1, 2, 1] blur per axis over the basin's voxels, padded so the surface closes. */
function blurredMask(keep) {
  const lo = [N, N, N], hi = [0, 0, 0];
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!keep[(z * N + y) * N + x]) continue;
    [x, y, z].forEach((v, a) => { lo[a] = Math.min(lo[a], v); hi[a] = Math.max(hi[a], v); });
  }
  const pad = 4, o = lo.map(v => v - pad), n = hi.map((v, a) => v - lo[a] + 1 + 2 * pad);
  let f = new Float32Array(n[0] * n[1] * n[2]);
  for (let z = 0; z < n[2]; z++) for (let y = 0; y < n[1]; y++) for (let x = 0; x < n[0]; x++) {
    const g = [x + o[0], y + o[1], z + o[2]];
    if (g.every(v => v >= 0 && v < N) && at(keep, g)) f[(z * n[1] + y) * n[0] + x] = 1;
  }
  const strides = [1, n[0], n[0] * n[1]];
  for (let pass = 0; pass < 2; pass++) for (let a = 0; a < 3; a++) {
    const out = new Float32Array(f.length);
    for (let i = 0; i < f.length; i++) {
      const c = Math.floor(i / strides[a]) % n[a];
      out[i] = (2 * f[i] + (c > 0 ? f[i - strides[a]] : 0) + (c < n[a] - 1 ? f[i + strides[a]] : 0)) / 4;
    }
    f = out;
  }
  return { f, n, o };
}

/** Naive surface nets: one vertex per cell the surface crosses, at its mean edge crossing; one quad per crossed edge. */
function surfaceNets(f, n, iso) {
  const [nx, ny, nz] = n, idx = (x, y, z) => (z * ny + y) * nx + x;
  const cell = new Int32Array(nx * ny * nz).fill(-1), verts = [], tris = [];
  const edges = [];
  for (let a = 0; a < 8; a++) for (const bit of [1, 2, 4]) if (!(a & bit)) edges.push([a, a | bit]);
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    const c = [];
    let mask = 0;
    for (let k = 0; k < 8; k++) {
      c[k] = f[idx(x + (k & 1), y + ((k >> 1) & 1), z + ((k >> 2) & 1))];
      if (c[k] > iso) mask |= 1 << k;
    }
    if (mask === 0 || mask === 255) continue;
    const p = [0, 0, 0];
    let m = 0;
    for (const [a, b] of edges) {
      if (((mask >> a) & 1) === ((mask >> b) & 1)) continue;
      const t = (iso - c[a]) / (c[b] - c[a]);
      for (let d = 0; d < 3; d++) p[d] += ((a >> d) & 1) + t * (((b >> d) & 1) - ((a >> d) & 1));
      m++;
    }
    cell[idx(x, y, z)] = verts.length / 3;
    verts.push(x + p[0] / m, y + p[1] / m, z + p[2] / m);
  }
  const step = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let z = 1; z < nz - 1; z++) for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) {
    const inside = f[idx(x, y, z)] > iso;
    for (let a = 0; a < 3; a++) {
      const e = step[a];
      if (inside === f[idx(x + e[0], y + e[1], z + e[2])] > iso) continue;
      // The four cells around this edge, turning the same way for every axis so the winding is consistent.
      const j = step[(a + 1) % 3], k = step[(a + 2) % 3];
      const q = [[0, 0, 0], j, [j[0] + k[0], j[1] + k[1], j[2] + k[2]], k].map(d => cell[idx(x - d[0], y - d[1], z - d[2])]);
      if (q.some(v => v < 0)) continue;
      if (inside) tris.push(q[0], q[1], q[2], q[0], q[2], q[3]);
      else tris.push(q[0], q[2], q[1], q[0], q[3], q[2]);
    }
  }
  return { verts, tris };
}

const grids = await cf4Grids();
for (const b of BASINS) if (at(grids[b.grid], voxelOf(b.core)) !== b.label) throw new Error(`${b.id}: its attractor falls outside basin ${b.label}`);
if (at(grids.BoA, voxelOf([0, 0, 0])) !== 1) throw new Error('the Sun is not in Laniakea');
for (const b of BASINS) {
  const eq = apply(SG_TO_EQ, b.core), r = Math.hypot(...eq);
  const ra = ((Math.atan2(eq[1], eq[0]) / R) + 360) % 360, dec = Math.asin(eq[2] / r) / R;
  if (Math.abs(((ra - b.radec[0] + 540) % 360) - 180) * Math.cos(dec * R) > 1.5 || Math.abs(dec - b.radec[1]) > 1.5) throw new Error(`${b.id}: supergalactic frame off (RA ${ra.toFixed(1)}, Dec ${dec.toFixed(1)})`);
}
const toEq = sg => apply(SG_TO_EQ, sg).map(v => v * MLY_PER_HMPC);
const velocity = await cf4Velocity();
const flows = [];
const meshes = BASINS.map((b, bi) => {
  const keep = basinVoxels(grids[b.grid], b.label, b.core);
  const { lines, reached } = streamlines(velocity, keep, b.core, b.grid === 'BoA' ? 1 : -1, b.id === 'laniakea' ? 320 : 140, 7 + bi);
  if (reached < 0.6) throw new Error(`${b.id}: only ${(reached * 100).toFixed(0)}% of its streamlines reach its core`);
  for (const l of lines) flows.push({ basin: bi, points: l.map(p => toEq(p.map(c => (c + 0.5) * VOX - 500))) });
  console.log(`${b.id}: ${lines.length} streamlines, ${(reached * 100).toFixed(0)}% reach the core`);
  const { f, n, o } = blurredMask(keep);
  const { verts, tris } = surfaceNets(f, n, 0.5);
  const positions = [];
  for (let i = 0; i < verts.length; i += 3) positions.push(...toEq([0, 1, 2].map(a => (verts[i + a] + o[a] + 0.5) * VOX - 500)));
  let count = 0;
  const sum = [0, 0, 0];
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!keep[(z * N + y) * N + x]) continue;
    count++;
    [x, y, z].forEach((v, a) => { sum[a] += (v + 0.5) * VOX - 500; });
  }
  let across = 0;
  for (let i = 0; i < positions.length; i += 3) for (let j = i + 3; j < positions.length; j += 3) {
    across = Math.max(across, Math.hypot(positions[i] - positions[j], positions[i + 1] - positions[j + 1], positions[i + 2] - positions[j + 2]));
  }
  const volume = count * VOX ** 3;
  const round = v => +v.toFixed(1);
  return {
    positions, tris,
    meta: {
      id: b.id, kind: b.grid === 'BoA' ? 'attraction' : 'repulsion',
      centre: toEq(sum.map(v => v / count)).map(round), core: toEq(b.core).map(round),
      reffMly: round(Math.cbrt((3 * volume) / (4 * Math.PI)) * MLY_PER_HMPC), acrossMly: Math.round(across),
      volumeHMpc3: +(volume / 1e6).toFixed(2),
    },
  };
});
const basinBytes = 4 + meshes.length * 8 + meshes.reduce((s, m) => s + m.positions.length * 4 + m.tris.length * 4, 0)
  + 4 + flows.length * 4 + flows.reduce((s, f) => s + f.points.length * 12, 0);
const bb = Buffer.alloc(basinBytes);
bb.writeUInt32LE(meshes.length, 0);
let bo = 4;
for (const m of meshes) { bb.writeUInt32LE(m.positions.length / 3, bo); bb.writeUInt32LE(m.tris.length / 3, bo + 4); bo += 8; }
for (const m of meshes) {
  for (const v of m.positions) { bb.writeFloatLE(v, bo); bo += 4; }
  for (const v of m.tris) { bb.writeUInt32LE(v, bo); bo += 4; }
}
bb.writeUInt32LE(flows.length, bo);
bo += 4;
for (const f of flows) { bb.writeUInt16LE(f.basin, bo); bb.writeUInt16LE(f.points.length, bo + 2); bo += 4; }
for (const f of flows) for (const p of f.points) for (const c of p) { bb.writeFloatLE(c, bo); bo += 4; }
writeFileSync(OUT_BASINS, bb);
writeFileSync(OUT_BASINS_TS, `// Generated by tools/build-cosmic-web.mjs; do not edit.
import type { Basin, NearbyVoid } from './cosmic-web';

/** Dupuy & Courtois 2023 basins, Mly J2000 equatorial: centre of volume, attractor or repeller, sphere-of-volume radius. */
export const BASINS: Basin[] = [
${meshes.map(m => `  ${JSON.stringify(m.meta)},`).join('\n')}
];

/** Pustilnik et al. 2019, in catalogue order: name, and galaxies inside. */
export const NEARBY_VOIDS: NearbyVoid[] = [
${nearby.map(([, name, , , , , , , galaxies]) => `  ${JSON.stringify({ name, galaxies })},`).join('\n')}
];
`);
for (const m of meshes) console.log(`${m.meta.id}: ${m.positions.length / 3} vertices, ${m.tris.length / 3} triangles, ${m.meta.volumeHMpc3}e6 (h⁻¹ Mpc)³, ${m.meta.acrossMly} Mly end to end`);
console.log(`${meshes.length} basins → ${OUT_BASINS} (${(basinBytes / 1e6).toFixed(2)} MB)`);

const scl = (await tsv('J/A+A/539/A80/mainadap', ['RA2deg', 'DE2deg', 'Dist2', 'Diam', 'Ngal'])).map(r => r.map(Number))
  .filter(([, , , diam]) => diam > 30)
  .map(([ra, dec, dist, diam, ngal]) => [...unit(ra, dec).map(v => +(v * dist * MLY_PER_HMPC).toFixed(1)), +((diam / 2) * MLY_PER_HMPC).toFixed(1), ngal]);
writeFileSync(OUT_SCL, JSON.stringify(scl));
console.log(`${scl.length} superclusters → ${OUT_SCL}`);

const countBytes = Math.ceil((counts.length * 2) / 4) * 4;
const quantum = points.reduce((m, v) => Math.max(m, Math.abs(v)), 0) / 32767;
const buf = Buffer.alloc(16 + voids.length * 52 + countBytes + points.length * 2);
buf.writeUInt32LE(voids.length, 0);
buf.writeUInt32LE(counts.length, 4);
buf.writeUInt32LE(points.length / 3, 8);
buf.writeFloatLE(quantum, 12);
let o = 16;
for (const v of voids) for (const n of v) { buf.writeFloatLE(n, o); o += 4; }
counts.forEach((n, i) => buf.writeUInt16LE(n, o + i * 2));
o += countBytes;
for (const n of points) { buf.writeInt16LE(Math.round(n / quantum), o); o += 2; }
writeFileSync(OUT, buf);

// The voids lie in SDSS's northern cap; a frame mix-up would throw the filaments elsewhere on the sky.
const decs = [];
for (let i = 0; i < points.length; i += 3 * 97) decs.push(Math.asin(points[i + 2] / Math.hypot(points[i], points[i + 1], points[i + 2])) / R);
const ras = [];
for (let i = 0; i < points.length; i += 3 * 97) ras.push(((Math.atan2(points[i + 1], points[i]) / R) + 360) % 360);
const pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.floor(p * (a.length - 1))].toFixed(1);
console.log(`voids by catalogue: ${[0, 1, 2, 3].map(k => voids.filter(v => v[12] === k).length).join(' / ')}; quaia z=1 at ${(comovingHMpc(1) * MLY_PER_HMPC / 1000).toFixed(2)} Gly`);
console.log(`${voids.length} voids, ${counts.length} filaments, ${points.length / 3} points → ${OUT} (${(buf.length / 1e6).toFixed(2)} MB)`);
console.log(`filament Dec 5/50/95%: ${pct(decs, 0.05)} ${pct(decs, 0.5)} ${pct(decs, 0.95)}; RA: ${pct(ras, 0.05)} ${pct(ras, 0.5)} ${pct(ras, 0.95)}`);

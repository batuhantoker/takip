#!/usr/bin/env node
/**
 * Build what History's deep time draws, in public/data/paleo/:
 *
 *   node tools/build-deep-time.mjs [download-dir]
 *
 * plates.json, from Müller et al. 2025, a mantle-reference plate model after Cao et al. (2024), 1.8 Ga to now,
 * CC BY 4.0 (doi:10.5281/zenodo.17142287), read from the GPlates plate-model repository or from a directory
 * holding its Rotations.zip, Coastlines.zip and ContinentalPolygons.zip:
 *   rotations  per moving plate, its runs of total poles against one fixed plate: [fixed, Ma, lat, lon, angle, …]
 *   coast      today's coastlines cut by plate: [plate, appears Ma, disappears Ma, ring, hole…], rings flat lon,lat
 *   crust      the continental crust around them, shelves included, in the same form
 *
 * climate.json, from PhanDA (Judd et al. 2024, Science, doi:10.1126/science.adk3705): global mean surface
 * temperature and CO₂ percentiles per stage, 485 Ma to now, from PhanDA_GMSTandCO2_percentiles.csv (in the
 * directory when given). The EJJudd/PhanDA repository states no licence; it is published as the paper's data.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync, inflateRawSync } from 'node:zlib';

const MODEL = 'muller2025';
const REPO = `https://repo.gplates.org/webdav/pmm/${MODEL}`;
const OUT_DIR = path.join(process.cwd(), 'public', 'data', 'paleo');
const PHANDA = 'https://raw.githubusercontent.com/EJJudd/PhanDA/main/5_Outputs/PhanDA_GMSTandCO2_percentiles.csv';
const MAX_MA = 1800;

// Douglas-Peucker tolerance in metres, the smallest part kept, and coordinate decimals (2 ≈ 1 km).
const COAST_TOL_M = 9000;
const CRUST_TOL_M = 12000;
const MIN_PART_KM2 = 600;
const DECIMALS = 2;
// Edges are great-circle arcs; the map draws straight lon/lat lines, so long edges get midpoints before they turn.
const MAX_EDGE_DEG = 1.5;

async function load(dir, name) {
  if (dir) return readFile(path.join(dir, `${name}.zip`));
  const res = await fetch(`${REPO}/${name}.zip`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** name → contents, for the stored and deflated entries these archives hold. */
function unzip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('not a zip');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    files.set(name, method === 8 ? inflateRawSync(raw) : raw);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// ── Rotations ──

/** GPlates .rot lines: moving plate, Ma, pole lat, pole lon, angle, fixed plate, then a comment. 999 lines are comments. */
function parseRotations(texts) {
  const runs = new Map();
  for (const text of texts) {
    let last = null;
    for (const line of text.split(/\r?\n/)) {
      const f = line.split('!')[0].trim().split(/\s+/);
      if (f.length < 6 || !/^\d+$/.test(f[0])) continue;
      const [moving, t, lat, lon, angle, fixed] = f.map(Number);
      if (moving === 999 || [t, lat, lon, angle, fixed].some(Number.isNaN)) continue;
      if (!last || last.moving !== moving || last.fixed !== fixed) {
        last = { moving, fixed, poles: [] };
        if (!runs.has(moving)) runs.set(moving, []);
        runs.get(moving).push(last);
      }
      const prev = last.poles.at(-1);
      if (prev && t < prev[0]) throw new Error(`plate ${moving}: ${t} Ma after ${prev[0]} Ma`);
      if (!prev || t > prev[0]) last.poles.push([t, lat, lon, angle]);
    }
  }
  // The two files meet at 1000 Ma, where a run often carries on against the same fixed plate.
  const out = {};
  for (const [moving, list] of runs) {
    list.sort((a, b) => a.poles[0][0] - b.poles[0][0]);
    const merged = [];
    for (const run of list) {
      const prev = merged.at(-1);
      if (prev && prev.fixed === run.fixed && prev.poles.at(-1)[0] === run.poles[0][0]) prev.poles.push(...run.poles.slice(1));
      else merged.push(run);
    }
    out[moving] = merged.map(r => [r.fixed, ...r.poles.flat()]);
  }
  return out;
}

// ── Shapes ──

const timeOf = (s, open) => (/distantFuture/.test(s) ? 0 : /distantPast/.test(s) ? open : Number(s));

function parseGpml(xml) {
  const features = [];
  for (const chunk of xml.split('<gml:featureMember>').slice(1)) {
    const plate = Number(/<gpml:reconstructionPlateId>[\s\S]*?<gpml:value>(\d+)<\/gpml:value>/.exec(chunk)?.[1]);
    const begin = /<gml:begin>[\s\S]*?<gml:timePosition[^>]*>([^<]+)</.exec(chunk)?.[1] ?? 'http://gplates.org/times/distantPast';
    const end = /<gml:end>[\s\S]*?<gml:timePosition[^>]*>([^<]+)</.exec(chunk)?.[1] ?? 'http://gplates.org/times/distantFuture';
    const polygons = [];
    for (const [, body] of chunk.matchAll(/<gml:Polygon>([\s\S]*?)<\/gml:Polygon>/g)) {
      // GML lists lat before lon.
      const rings = [...body.matchAll(/<gml:posList[^>]*>([^<]+)<\/gml:posList>/g)].map(([, list]) => {
        const n = list.trim().split(/\s+/).map(Number);
        const ring = [];
        for (let i = 0; i + 1 < n.length; i += 2) ring.push([n[i + 1], n[i]]);
        return ring;
      });
      if (rings.length) polygons.push(rings);
    }
    if (Number.isFinite(plate) && polygons.length) features.push({ plate, from: Math.min(timeOf(begin, MAX_MA), MAX_MA), to: timeOf(end, 0), polygons });
  }
  return features;
}

const M_PER_DEG = 111_320;
const RAD = Math.PI / 180;

/** Longitudes made continuous, so a ring across the antimeridian simplifies like any other. */
function unwrap(ring) {
  const out = [ring[0].slice()];
  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0];
    const prev = out[i - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, ring[i][1]]);
  }
  return out;
}

function simplify(ring, tolM) {
  if (ring.length <= 4) return ring;
  const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const kx = M_PER_DEG * Math.max(0.05, Math.cos(lat0 * RAD));
  const xy = ring.map(([x, y]) => [x * kx, y * M_PER_DEG]);
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = xy[a];
    const [bx, by] = xy[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      const d = len ? Math.abs(dy * px - dx * py + bx * ay - by * ax) / len : Math.hypot(px - ax, py - ay);
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tolM) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

const wrapDeg = d => d - 360 * Math.round(d / 360);

/** km² of a ring on the sphere. Each step east is wrapped, so a detour along a pole adds nothing. */
function areaKm2(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    s += wrapDeg(x2 - x1) * RAD * (2 + Math.sin(y1 * RAD) + Math.sin(y2 * RAD));
  }
  return Math.abs((s * 6371 * 6371) / 2);
}

const toVec = ([lon, lat]) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
const toLonLat = ([x, y, z]) => [Math.atan2(y, x) / RAD, Math.asin(Math.max(-1, Math.min(1, z))) / RAD];

function densify(ring) {
  const out = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = toVec(ring[i]);
    const b = toVec(ring[i + 1]);
    const angle = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / RAD;
    out.push(ring[i]);
    const n = Math.ceil(angle / MAX_EDGE_DEG);
    for (let k = 1; k < n; k++) {
      const f = k / n;
      const s = Math.sin(angle * RAD);
      const wa = Math.sin((1 - f) * angle * RAD) / s;
      const wb = Math.sin(f * angle * RAD) / s;
      out.push(toLonLat([wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2]]));
    }
  }
  out.push(ring.at(-1));
  return out;
}

const round = v => Math.round(v * 10 ** DECIMALS) / 10 ** DECIMALS;
const normLon = lon => ((((lon + 180) % 360) + 360) % 360) - 180;

/** The ring as flat lon,lat, closing vertex dropped; null once it is too small to see on the globe. */
function prepare(ring, tolM, minKm2) {
  const closed = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring : [...ring, ring[0]];
  const u = unwrap(closed);
  if (minKm2 && areaKm2(ring) < minKm2) return null;
  const flat = [];
  let prev = null;
  for (const [lon, lat] of densify(simplify(u, tolM)).slice(0, -1)) {
    const p = [round(normLon(lon)), round(lat)];
    // At a pole every longitude is the same point.
    if (prev && (prev[0] === p[0] || Math.abs(p[1]) === 90) && prev[1] === p[1]) continue;
    flat.push(...p);
    prev = p;
  }
  return flat.length >= 6 ? flat : null;
}

function bake(features, tolM) {
  const out = [];
  let vertices = 0;
  for (const f of features) {
    // Islands under the cut stay when they are all a feature has.
    const largest = Math.max(...f.polygons.map(p => areaKm2(p[0])));
    for (const rings of f.polygons) {
      const min = areaKm2(rings[0]) === largest ? 0 : MIN_PART_KM2;
      const outer = prepare(rings[0], tolM, min);
      if (!outer) continue;
      const holes = rings.slice(1).map(r => prepare(r, tolM, MIN_PART_KM2)).filter(Boolean);
      out.push([f.plate, f.from, f.to, outer, ...holes]);
      vertices += (outer.length + holes.reduce((s, h) => s + h.length, 0)) / 2;
    }
  }
  return { out, vertices };
}

// ── Labels ──

// ── Climate ──

async function climate(dir) {
  const text = dir
    ? await readFile(path.join(dir, path.basename(PHANDA)), 'utf8')
    : await fetch(PHANDA).then(r => {
      if (!r.ok) throw new Error(`PhanDA: HTTP ${r.status}`);
      return r.text();
    });
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const col = Object.fromEntries(head.split(',').map((h, i) => [h, i]));
  const rows = lines.map(l => l.split(',')).map(f => [
    Number(f[col.AverageAge]),
    ...['GMST_16', 'GMST_50', 'GMST_84'].map(k => Math.round(Number(f[col[k]]) * 10) / 10),
    ...['CO2_16', 'CO2_50', 'CO2_84'].map(k => Math.round(Number(f[col[k]]))),
  ]);
  if (rows.some(r => r.some(Number.isNaN))) throw new Error('PhanDA: unreadable row');
  return rows.sort((a, b) => a[0] - b[0]);
}

const dir = process.argv[2];
const [rot, coast, crust] = await Promise.all(['Rotations', 'Coastlines', 'ContinentalPolygons'].map(n => load(dir, n).then(unzip)));
const rotTexts = [...rot].filter(([n]) => n.endsWith('.rot')).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })).map(([, b]) => b.toString('latin1'));
const gpml = files => {
  const [name, buf] = [...files].find(([n]) => /\.gpmlz?$/.test(n));
  return parseGpml((name.endsWith('z') ? gunzipSync(buf) : buf).toString('utf8'));
};
const coastFeatures = gpml(coast);
const coastBaked = bake(coastFeatures, COAST_TOL_M);
const crustBaked = bake(gpml(crust), CRUST_TOL_M);
const rotations = parseRotations(rotTexts);

const plates = {
  model: {
    name: 'Müller et al. 2025, after Cao et al. 2024',
    attribution: 'Plates: Müller et al. 2025 after Cao et al. 2024 (CC BY 4.0)',
    doi: '10.5281/zenodo.17142287',
    maxMa: MAX_MA,
  },
  rotations,
  coast: coastBaked.out,
  crust: crustBaked.out,
};
const climateJson = {
  source: { name: 'PhanDA', attribution: 'Temperature and CO₂: PhanDA, Judd et al. 2024', doi: '10.1126/science.adk3705' },
  rows: await climate(dir),
};
await mkdir(OUT_DIR, { recursive: true });
const text = JSON.stringify(plates);
await writeFile(path.join(OUT_DIR, 'plates.json'), text);
await writeFile(path.join(OUT_DIR, 'climate.json'), JSON.stringify(climateJson));
console.log(`plates.json: ${Object.keys(rotations).length} plates, coast ${coastBaked.out.length} rings ${coastBaked.vertices} vertices, crust ${crustBaked.out.length} rings ${crustBaked.vertices} vertices, ${(text.length / 1e6).toFixed(2)} MB`);
console.log(`climate.json: ${climateJson.rows.length} stages`);

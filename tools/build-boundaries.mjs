#!/usr/bin/env node
/**
 * Build the country and state/province outlines the Areas tool picks from.
 *
 *   node tools/build-boundaries.mjs [download-dir]
 *
 * Reads Natural Earth (public domain) admin-0 at 50m and admin-1 at 10m, downloading them from
 * the v5.1.2 tag when no directory is given, and writes public/data/boundaries/:
 *   countries.json        every country, one file
 *   admin1/<ADM0_A3>.json one country's states/provinces, fetched when that country is zoomed into
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const NE_TAG = 'v5.1.2';
const NE_URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_TAG}/geojson`;
const OUT = path.join(process.cwd(), 'public', 'data', 'boundaries');

// Douglas-Peucker tolerance in metres, and coordinate decimals (3 ≈ 110 m).
const COUNTRY_TOL_M = 1500;
const ADMIN1_TOL_M = 1000;
const DECIMALS = 3;
// Islets below this are dropped (unless they are all a feature has); they are most of the vertices.
const COUNTRY_MIN_PART_KM2 = 20;
const ADMIN1_MIN_PART_KM2 = 5;

async function load(dir, name) {
  if (dir) return JSON.parse(await readFile(path.join(dir, `${name}.geojson`), 'utf8'));
  const res = await fetch(`${NE_URL}/${name}.geojson`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
}

const M_PER_DEG = 111_320;

function simplify(ring, tolM) {
  if (ring.length <= 4) return ring;
  const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const kx = M_PER_DEG * Math.cos((lat0 * Math.PI) / 180);
  const xy = ring.map(([x, y]) => [x * kx, y * M_PER_DEG]);
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  const tol2 = tolM * tolM;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = xy[a], [bx, by] = xy[b];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let worst = -1, worstD = tol2;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > worstD) { worstD = d; worst = i; }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

const f = 10 ** DECIMALS;
const round = v => Math.round(v * f) / f;

function slimRing(ring, tolM) {
  const out = [];
  for (const [x, y] of simplify(ring, tolM)) {
    const p = [round(x), round(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out.length >= 4 ? out : null;
}

/** Planar shoelace on locally scaled degrees; only used to rank islets, so the error is irrelevant. */
function areaKm2(ring) {
  const kx = Math.cos((ring[0][1] * Math.PI) / 180);
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] * kx) * ring[i][1] - (ring[i][0] * kx) * ring[j][1];
  }
  return (Math.abs(a) / 2) * (M_PER_DEG / 1000) ** 2;
}

/** Islets and collapsed rings are dropped; a feature never loses every part. */
function slimGeometry(g, tolM, minPartKm2) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const kept = [];
  for (const rings of polys) {
    const outer = slimRing(rings[0], tolM);
    if (!outer || areaKm2(outer) < minPartKm2) continue;
    kept.push([outer, ...rings.slice(1).map(r => slimRing(r, tolM)).filter(Boolean)]);
  }
  if (!kept.length) {
    // Tiny islands (Nauru, Monaco): keep the largest part unsimplified so it stays pickable.
    const largest = polys.reduce((a, b) => (b[0].length > a[0].length ? b : a));
    kept.push([largest[0].map(([x, y]) => [round(x), round(y)])]);
  }
  return kept.length === 1
    ? { type: 'Polygon', coordinates: kept[0] }
    : { type: 'MultiPolygon', coordinates: kept };
}

const code = v => (v && v !== '-99' ? v : undefined);
// Natural Earth has no ISO code for Kosovo; geoBoundaries files it under the user-assigned XKX.
const ISO3_GAPS = { KOS: 'XKX' };

function country(ft) {
  const p = ft.properties;
  return {
    type: 'Feature',
    properties: {
      id: p.ADM0_A3,
      name: p.NAME_EN || p.NAME,
      iso2: code(p.ISO_A2_EH) ?? code(p.ISO_A2),
      // geoBoundaries keys countries by ISO alpha-3, which differs from ADM0_A3 for a few (SDS/SSD, PSX/PSE).
      iso3: code(p.ISO_A3_EH) ?? code(p.ISO_A3) ?? ISO3_GAPS[p.ADM0_A3],
      label: [p.LABEL_X, p.LABEL_Y],
    },
    geometry: slimGeometry(ft.geometry, COUNTRY_TOL_M, COUNTRY_MIN_PART_KM2),
  };
}

function admin1(ft) {
  const p = ft.properties;
  return {
    type: 'Feature',
    properties: {
      id: p.adm1_code,
      name: p.name_en || p.name || p.gn_name,
      country: p.admin,
      countryId: p.adm0_a3,
      iso: code(p.iso_3166_2),
      kind: p.type_en || undefined,
      label: [p.longitude, p.latitude],
    },
    geometry: slimGeometry(ft.geometry, ADMIN1_TOL_M, ADMIN1_MIN_PART_KM2),
  };
}

const collection = features => `{"type":"FeatureCollection","features":[\n${features.map(x => JSON.stringify(x)).join(',\n')}\n]}\n`;

async function main() {
  const dir = process.argv[2];
  const [ne0, ne1] = await Promise.all([
    load(dir, 'ne_50m_admin_0_countries'),
    load(dir, 'ne_10m_admin_1_states_provinces'),
  ]);

  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, 'admin1'), { recursive: true });

  const countries = ne0.features.filter(ft => ft.geometry).map(country);
  await writeFile(path.join(OUT, 'countries.json'), collection(countries));

  // A state is only reachable through its country, so territories missing from the 50m set are skipped.
  const byCountry = new Map(countries.map(c => [c.properties.id, []]));
  let states = 0;
  for (const ft of ne1.features) {
    if (!ft.geometry) continue;
    const s = admin1(ft);
    const list = byCountry.get(s.properties.countryId);
    if (!list) continue;
    list.push(s);
    states++;
  }
  for (const [id, list] of byCountry) {
    if (list.length) await writeFile(path.join(OUT, 'admin1', `${id}.json`), collection(list));
  }

  console.log(`${countries.length} countries, ${states} states/provinces → ${OUT}`);
}

main().catch(err => { console.error(err); process.exit(1); });

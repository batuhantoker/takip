import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoLayerWriter, GeoPrec, type Geometry, type Position, type Ring, simplify } from '@takip/db';
import { type Ctx, importDataset, REPO } from '../context';
import { utc } from '../dates';
import { EventBatch } from '../events';
import { readShapefile } from '../shp';

/*
 * Stanford Spatial History Lab, "European Borders, World War II" (Michael De Groot, 2010): every polity in Europe at
 * each month's end from Feb 1938 to May 1945, plus the 81 annexations with their exact dates. Annexations only:
 * military occupation is an attribute ("German-occupied"), not a border. Non-commercial use only.
 */

export const DIR = join(REPO, 'docs/data/raw-2026-10-12-ww2/extracted/EuropeanBorders_WWII');
const CHANGES = 'Territorial_Changes';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** The last snapshot (31 May 1945) is shown for one more month: the source stops there. */
const TAIL_MS = 30 * 86_400_000;
/** The survey detail (metres) is far finer than a continental history map needs. */
const DETAIL = 0.01;
/**
 * Unchanged shapes are redigitised slightly each month (vertex counts drift, area moves ~1e-6), while the smallest
 * annexation (Eupen-Malmédy into Germany) moves area ~1e-3; a month inside this tolerance is the same border.
 */
const SAME_AREA = 1e-4;

/** Europe_Albers_Equal_Area_Conic on the International 1924 ellipsoid (ED50); the ~100 m datum shift is ignored. */
const ALBERS = { a: 6378388, f: 1 / 297, lat0: 30, lat1: 43, lat2: 62, lon0: 10 };

function inverseAlbers() {
  const { a, f } = ALBERS;
  const e2 = 2 * f - f * f;
  const e = Math.sqrt(e2);
  const rad = Math.PI / 180;
  const m = (phi: number) => Math.cos(phi) / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const q = (phi: number) => {
    const s = Math.sin(phi);
    return (1 - e2) * (s / (1 - e2 * s * s) - (1 / (2 * e)) * Math.log((1 - e * s) / (1 + e * s)));
  };
  const [p0, p1, p2] = [ALBERS.lat0, ALBERS.lat1, ALBERS.lat2].map(d => d * rad);
  const n = (m(p1) ** 2 - m(p2) ** 2) / (q(p2) - q(p1));
  const C = m(p1) ** 2 + n * q(p1);
  const rho0 = (a * Math.sqrt(C - n * q(p0))) / n;
  return ([x, y]: Position): Position => {
    const rho = Math.hypot(x, rho0 - y);
    const theta = Math.atan2(x, rho0 - y);
    const qv = (C - (rho * n / a) ** 2) / n;
    let phi = Math.asin(Math.max(-1, Math.min(1, qv / 2)));
    for (let i = 0; i < 15; i++) {
      const s = Math.sin(phi);
      const next = phi + ((1 - e2 * s * s) ** 2 / (2 * Math.cos(phi))) * (qv / (1 - e2) - s / (1 - e2 * s * s) + (1 / (2 * e)) * Math.log((1 - e * s) / (1 + e * s)));
      if (Math.abs(next - phi) < 1e-12) {
        phi = next;
        break;
      }
      phi = next;
    }
    const round = (v: number) => Math.round(v * 1e5) / 1e5;
    return [round(ALBERS.lon0 + theta / n / rad), round(phi / rad)];
  };
}

const toLonLat = inverseAlbers();
export const reproject = (g: Geometry): Geometry => {
  const ring = (r: Ring) => r.map(toLonLat);
  if (g.type === 'Polygon') return { type: 'Polygon', coordinates: g.coordinates.map(ring) };
  if (g.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: g.coordinates.map(p => p.map(ring)) };
  throw new Error(`unexpected ${g.type}`);
};

/** Area-weighted centre of the largest outer ring: where a label or an event mark goes. */
export function area(g: Geometry) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  let a = 0;
  for (const poly of polys) {
    poly.forEach((r, k) => {
      let s = 0;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
      a += (k === 0 ? 1 : -1) * Math.abs(s / 2);
    });
  }
  return a;
}

export function labelPoint(g: Geometry): Position {
  const rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map(p => p[0]) : [];
  let best: { area: number; c: Position } = { area: -1, c: [0, 0] };
  for (const r of rings) {
    let a = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const cross = r[j][0] * r[i][1] - r[i][0] * r[j][1];
      a += cross;
      cx += (r[j][0] + r[i][0]) * cross;
      cy += (r[j][1] + r[i][1]) * cross;
    }
    if (Math.abs(a) > best.area) best = { area: Math.abs(a), c: [Math.round((cx / (3 * a)) * 1e4) / 1e4, Math.round((cy / (3 * a)) * 1e4) / 1e4] };
  }
  return best.c;
}

/** The source's own spellings vary between months. */
const NAMES: Record<string, string> = {
  'Reichkommissariat Ostland': 'Reichskommissariat Ostland',
  'Protectorate of Bohemia Moravia': 'Protectorate of Bohemia and Moravia',
};

export type Alignment = 'axis' | 'occupied' | 'belligerent' | 'allied' | 'neutral' | 'none';

/** At war before the Tripartite Pact (Sep 1940) but already the Axis core (Pact of Steel, May 1939). */
const AXIS_CORE = new Set(['Germany', 'Italy']);

/**
 * Foreign_Po → map classes; the raw text stays in props for the popup. "Belligerent" means at war outside the
 * blocs: Germany and Italy before the Tripartite Pact, the USSR from Poland (Sep 1939) to Barbarossa (Jun 1941).
 */
export function alignment(status: string | null, name = ''): Alignment {
  if (!status) return 'none';
  if (/occupied|protectorate/i.test(status)) return 'occupied';
  if (/^(axis|axis-aligned|war with soviet union)$/i.test(status)) return 'axis';
  if (/^belligerent$/i.test(status)) return AXIS_CORE.has(name) ? 'axis' : 'belligerent';
  if (/^(allies|allied)$/i.test(status)) return 'allied';
  if (/^neutral$/i.test(status)) return 'neutral';
  return 'none';
}

/** stage.manual_fix: statuses the source gets plainly wrong, by polity and snapshot range [from, to). */
const FIXES: { name: string; from: string; to: string; status: string; note: string }[] = [
  { name: 'Italy', from: '1940-06-30', to: '1940-07-01', status: 'Belligerent', note: 'source: Neutral; Italy declared war on 10 Jun 1940' },
  { name: 'Italy', from: '1941-09-30', to: '1942-08-31', status: 'Axis', note: 'source: Allies; Italy changed sides only in Sep 1943' },
];

const utcIso = (d: string) => Date.parse(`${d}T00:00:00Z`);
const clean = (s: string | undefined) => (s && s !== '<Null>' ? s : null);

/** "June_30_1942" → epoch ms. */
export function snapshotDate(base: string): number | undefined {
  const m = /^([A-Za-z]+)_(\d{1,2})_(\d{4})$/.exec(base);
  const month = m ? MONTHS.indexOf(m[1]) : -1;
  return m && month >= 0 ? utc(Number(m[3]), month + 1, Number(m[2])) : undefined;
}

type Snapshot = { at: number; status: string | null; head: string | null; exile: string | null; geom: Geometry };

/**
 * Two snapshots (Sep and Nov 1942) lose most statuses. A blank between two equal statuses takes that status;
 * a blank at either end of a run stays blank, since that is how the source marks "not at war".
 */
export function fillStatusGaps(runs: { status: string | null }[]): number {
  let filled = 0;
  for (let i = 1; i + 1 < runs.length; i++) {
    if (runs[i].status !== null || runs[i - 1].status === null || runs[i - 1].status !== runs[i + 1].status) continue;
    runs[i].status = runs[i - 1].status;
    filled++;
  }
  return filled;
}

type Open = { from: number; until: number; key: string; area: number; props: Record<string, unknown>; geom: Geometry; label: Position };

export async function importWw2Borders(ctx: Ctx) {
  const snapshots = readdirSync(DIR)
    .filter(f => f.endsWith('.shp') && !f.startsWith(CHANGES))
    .map(f => f.slice(0, -4))
    .map(base => ({ base, at: snapshotDate(base) }))
    .filter((s): s is { base: string; at: number } => s.at !== undefined)
    .sort((x, y) => x.at - y.at);
  const prj = readFileSync(join(DIR, `${snapshots[0].base}.prj`), 'utf8');
  if (!/Albers/.test(prj) || !/"Central_Meridian",10\.0/.test(prj) || !/"Standard_Parallel_2",62\.0/.test(prj)) throw new Error('ww2: unexpected projection');
  const files = [...snapshots.map(s => join(DIR, `${s.base}.shp`)), join(DIR, `${CHANGES}.shp`)];

  await importDataset(ctx, { source: 'ww2-borders', version: '2010', asOf: '2010-08-01', files, importerVersion: '4' }, async ds => {
    const w = GeoLayerWriter.open(ctx.layout, ctx.catalog, {
      code: 'ww2-europe', sourceId: ds.sourceId, geomKind: 'polygon', timeMode: 'valid', minzoom: 2,
      tileProps: ['name', 'status', 'alignment', 'head', 'exile'], keepSmall: true, maxzoom: 9,
    });
    try {
      const open = new Map<string, Open>();
      const close = (name: string) => {
        const o = open.get(name)!;
        w.add({ sourceRecordId: `${name}@${new Date(o.from).toISOString().slice(0, 10)}`, validLo: o.from, validHi: o.until, tPrec: Prec.month, props: { ...o.props, label: o.label }, geom: o.geom });
        open.delete(name);
      };
      // Pass 1: every polity's snapshots in time order, with the source's slips mended.
      const byName = new Map<string, Snapshot[]>();
      for (const { base, at } of snapshots) {
        const seen = new Set<string>();
        for (const { geometry, props } of readShapefile(join(DIR, base))) {
          ds.report.rows++;
          const raw = clean(props.Name);
          if (!raw || !geometry) {
            ds.report.reject(!raw ? 'no name' : 'no geometry', `${base}:${raw}`);
            continue;
          }
          const name = NAMES[raw] ?? raw;
          if (seen.has(name)) {
            ds.report.reject('duplicate name in a month', `${base}:${name}`);
            continue;
          }
          seen.add(name);
          let status = clean(props.Foreign_Po);
          const fix = FIXES.find(f => f.name === name && utcIso(f.from) <= at && at < utcIso(f.to));
          if (fix) {
            status = fix.status;
            ds.report.sentinel(`manual_fix: ${name} ${fix.note}`);
          }
          const list = byName.get(name) ?? [];
          list.push({ at, status, head: clean(props.Head_of_St), exile: clean(props.Govt_in_Ex), geom: simplify(reproject(geometry), DETAIL, true)! });
          byName.set(name, list);
        }
      }
      // Pass 2: runs of unchanged months become one feature each.
      const next = new Map(snapshots.map((s, i) => [s.at, snapshots[i + 1]?.at ?? s.at + TAIL_MS]));
      for (const [name, list] of byName) {
        const filled = fillStatusGaps(list);
        if (filled) ds.report.sentinel(`status gap filled: ${name}`);
        for (const snap of list) {
          const p = { name, status: snap.status, alignment: alignment(snap.status, name), head: snap.head, exile: snap.exile };
          const key = JSON.stringify(p);
          const a = area(snap.geom);
          const prev = open.get(name);
          // A polity missing from the month before starts again rather than bridging the gap.
          if (prev && prev.key === key && prev.until === snap.at && Math.abs(a - prev.area) <= SAME_AREA * prev.area) {
            prev.until = next.get(snap.at)!;
            continue;
          }
          if (prev) close(name);
          open.set(name, { from: snap.at, until: next.get(snap.at)!, key, area: a, props: p, geom: snap.geom, label: labelPoint(snap.geom) });
        }
        close(name);
      }
      const out = w.publish();
      ds.report.extra.layer = { code: out.code, version: out.version, features: out.features, pieces: out.pieces, bytes: out.bytes, months: snapshots.length };
    } catch (e) {
      w.abort();
      throw e;
    }

    const events = new EventBatch(ctx, ds);
    for (const { geometry, props } of readShapefile(join(DIR, CHANGES))) {
      const territory = clean(props.TERRITORY_);
      const date = clean(props.CHANGE_DAT);
      if (!territory || !date || !geometry) {
        ds.report.reject('change without territory, date or shape', `${territory}:${date}`);
        continue;
      }
      const [lon, lat] = labelPoint(reproject(geometry));
      const government = clean(props.GOVT);
      events.add({
        kind: 'change.territorial',
        sourceRecordId: `${territory}:${date}`,
        title: government ? `${territory} → ${government}` : territory,
        tStart: utc(Number(date.slice(0, 4)), Number(date.slice(4, 6)), Number(date.slice(6, 8))),
        tStartPrec: Prec.day,
        lon,
        lat,
        geoPrec: GeoPrec.area,
        attrs: {
          government,
          former_government: clean(props.FORMER_GOV),
          alt_names: clean(props.ALT_NAME),
          type: clean(props.TYPE),
          history: clean(props.HISTORICAL),
          source_map: [clean(props.Source_Nam), clean(props.Source_Dat), clean(props.Source_Sca), clean(props.Source_Pub)].filter(Boolean).join(' · ') || null,
        },
      });
    }
    return events.finish();
  });
}

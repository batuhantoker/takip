import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { type EventInput, GeoPrec, type Position, toWkb } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE, type Reporter } from '../context';
import { csvRows, num } from '../csv';
import { EventBatch } from '../events';
import { IBTRACS_FILE } from '../fetch-politics';

const FILE = join(RAW_MORE, 'ibtracs', IBTRACS_FILE);
const VERSION = 'v04r01';
const AS_OF = '2026-10-18';

const BASINS: Record<string, string> = {
  NA: 'North Atlantic', SA: 'South Atlantic', EP: 'Eastern North Pacific', WP: 'Western North Pacific', SP: 'South Pacific',
  SI: 'South Indian Ocean', NI: 'North Indian Ocean',
};
const SUBBASINS: Record<string, string> = {
  CS: 'Caribbean Sea', GM: 'Gulf of Mexico', CP: 'Central Pacific', BB: 'Bay of Bengal', AS: 'Arabian Sea', WA: 'off Western Australia', EA: 'off Eastern Australia',
};
/** Sustained winds average over different periods by agency, so a value is only comparable within one. */
const AGENCIES: Record<string, string> = {
  USA: 'US agencies (NHC, CPHC, JTWC), 1-min sustained', hurdat_atl: 'NHC (HURDAT2), 1-min sustained', hurdat_epa: 'NHC (HURDAT2), 1-min sustained',
  atcf: 'JTWC, 1-min sustained', cphc: 'CPHC, 1-min sustained', tokyo: 'JMA Tokyo, 10-min sustained', bom: 'Australian BoM, 10-min sustained',
  reunion: 'Météo-France La Réunion, 10-min sustained', newdelhi: 'IMD New Delhi, 3-min sustained', wellington: 'MetService Wellington, 10-min sustained',
  nadi: 'Fiji Met Service Nadi, 10-min sustained', TOKYO: 'JMA Tokyo, 10-min sustained', CMA: 'China Meteorological Administration, 2-min sustained',
  HKO: 'Hong Kong Observatory, 10-min sustained', NEWDELHI: 'IMD New Delhi, 3-min sustained', REUNION: 'Météo-France La Réunion, 10-min sustained',
  BOM: 'Australian BoM, 10-min sustained', NADI: 'Fiji Met Service Nadi, 10-min sustained', WELLINGTON: 'MetService Wellington, 10-min sustained',
  DS824: 'NCAR DS824 historical archive', TD9636: 'NCEI TD-9636 historical archive', TD9635: 'NCEI TD-9635 historical archive',
  NEUMANN: 'Neumann Southern Hemisphere reanalysis', MLC: 'Mark Lander (WP reanalysis)',
};
const OTHER_WINDS = ['TOKYO', 'CMA', 'HKO', 'NEWDELHI', 'REUNION', 'BOM', 'NADI', 'WELLINGTON', 'DS824', 'TD9636', 'TD9635', 'NEUMANN', 'MLC'];
/** Saffir–Simpson, from the US agencies' winds; below 1 are tropical storm and depression, the negatives not tropical. */
const SSHS: Record<number, string> = { 5: 'Category 5', 4: 'Category 4', 3: 'Category 3', 2: 'Category 2', 1: 'Category 1', 0: 'tropical storm', [-1]: 'tropical depression' };

type Fix = {
  t: number;
  lon: number;
  lat: number;
  usa: number | null;
  wmo: number | null;
  other: number | null;
  otherFrom: string | null;
  pres: number | null;
  sshs: number | null;
  basin: string;
  sub: string;
};
type Storm = { sid: string; name: string; trackType: string; atcf: string | null; wmoAgency: string | null; fixes: Fix[] };
export type StormEvent = Omit<EventInput, 'sourceId' | 'datasetId'>;

const iso = (s: string) => Date.parse(`${s.trim().replace(' ', 'T')}Z`);
const SYNOPTIC_MS = 6 * 3_600_000;

/** One storm's rows, which the file keeps together and in time order; the units row under the header is skipped. */
export async function* storms(path: string, rep: Reporter): AsyncGenerator<Storm> {
  let header: string[] | null = null;
  let col: Record<string, number> = {};
  let cur: Storm | null = null;
  let units = true;
  for await (const row of csvRows(path)) {
    if (!header) {
      header = row.map(h => h.trim());
      col = Object.fromEntries(header.map((h, i) => [h, i]));
      continue;
    }
    if (units) {
      units = false;
      if (row[col.SID]?.trim() === '') continue;
    }
    const v = (k: string) => row[col[k]]?.trim() ?? '';
    const sid = v('SID');
    if (cur && cur.sid !== sid) {
      yield cur;
      cur = null;
    }
    if (!cur) cur = { sid, name: v('NAME'), trackType: v('TRACK_TYPE'), atcf: v('USA_ATCF_ID') || null, wmoAgency: null, fixes: [] };
    if (!cur.atcf && v('USA_ATCF_ID')) cur.atcf = v('USA_ATCF_ID');
    if (!cur.wmoAgency && v('WMO_AGENCY')) cur.wmoAgency = v('WMO_AGENCY');
    let other: number | null = null;
    let otherFrom: string | null = null;
    for (const a of OTHER_WINDS) {
      const w = num(v(`${a}_WIND`));
      if (w !== null && (other === null || w > other)) [other, otherFrom] = [w, a];
    }
    const t = iso(v('ISO_TIME'));
    const lon = num(v('LON'));
    const lat = num(v('LAT'));
    if (!Number.isFinite(t) || lon === null || lat === null) {
      rep.reject('fix without time or position', `${sid} ${v('ISO_TIME')}`);
      continue;
    }
    cur.fixes.push({
      t, lon, lat, usa: num(v('USA_WIND')), wmo: num(v('WMO_WIND')), other, otherFrom,
      pres: num(v('WMO_PRES')) ?? num(v('USA_PRES')), sshs: num(v('USA_SSHS')), basin: v('BASIN'), sub: v('SUBBASIN'),
    });
  }
  if (cur) yield cur;
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

/** "Hurricane Katrina", "Typhoon Haiyan", "Unnamed tropical storm": the word from the peak wind and the basin it peaked in. */
export function stormTitle(name: string, basin: string, wind: number | null) {
  const strong = basin === 'WP' ? 'Typhoon' : basin === 'NA' || basin === 'EP' || basin === 'SA' ? 'Hurricane' : 'Cyclone';
  const word = wind === null ? 'Tropical cyclone' : wind >= 64 ? strong : wind >= 34 ? 'Tropical storm' : 'Tropical depression';
  const named = name && name !== 'UNNAMED' && name !== 'NOT_NAMED' ? name.split(':').map(titleCase).join(' / ') : null;
  return named ? `${word} ${named}` : `Unnamed ${word.toLowerCase()}`;
}

const round = (x: number) => Math.round(x * 100) / 100;
const wrap = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

/** Longitudes made continuous fix to fix, so a track across 180° stays one line. */
export function unwrap(lons: number[]) {
  const out: number[] = [];
  for (const lon of lons) {
    const prev = out[out.length - 1];
    out.push(prev === undefined ? lon : lon + 360 * Math.round((prev - lon) / 360));
  }
  return out;
}

/** The fix it is placed at: strongest wind on the most consistent scale it has, else lowest pressure, else mid-track. */
export function peakOf(fixes: Fix[]) {
  const series = (['usa', 'wmo', 'other'] as const).find(k => fixes.some(f => f[k] !== null));
  if (series) {
    let best = -1;
    fixes.forEach((f, i) => {
      const w = f[series];
      if (w === null) return;
      const b = best < 0 ? null : fixes[best];
      if (!b || w > b[series]! || (w === b[series] && (f.pres ?? Infinity) < (b.pres ?? Infinity))) best = i;
    });
    return { index: best, series, by: 'point of peak intensity on its track (strongest wind)' };
  }
  const withPres = fixes.map((f, i) => [f.pres, i] as const).filter(([p]) => p !== null);
  if (withPres.length) return { index: withPres.reduce((a, b) => (b[0]! < a[0]! ? b : a))[1], series: null, by: 'point of lowest pressure on its track (no wind recorded)' };
  return { index: Math.floor((fixes.length - 1) / 2), series: null, by: 'middle of its track (no intensity recorded)' };
}

/** A storm as one event at its peak, with the 6-hourly track as a line in geom. */
export function stormEvent(s: Storm): StormEvent {
  const { fixes } = s;
  const peak = peakOf(fixes);
  const p = fixes[peak.index];
  const wind = peak.series ? p[peak.series] : null;
  const agency = peak.series === 'usa' ? 'USA' : peak.series === 'wmo' ? s.wmoAgency : peak.series === 'other' ? p.otherFrom : null;
  const pressures = fixes.map(f => f.pres).filter((x): x is number => x !== null);
  const sshs = fixes.map(f => f.sshs).filter((x): x is number => x !== null && x >= -1);
  const top = sshs.length ? Math.max(...sshs) : null;
  const kept = fixes.filter((f, i) => i === 0 || i === fixes.length - 1 || i === peak.index || f.t % SYNOPTIC_MS === 0);
  const lons = unwrap(kept.map(f => f.lon));
  const line: Position[] = kept.map((f, i) => [round(lons[i]), round(f.lat)]);
  const crosses = lons.some(l => l < -180 || l > 180);
  const basins = [...new Set(fixes.map(f => f.basin).filter(b => BASINS[b]))];
  const provisional = s.trackType.includes('PROVISIONAL');
  return {
    kind: 'hazard.storm',
    sourceRecordId: s.sid,
    title: stormTitle(s.name, p.basin, wind),
    tStart: fixes[0].t,
    tStartPrec: Prec.hour,
    tEnd: fixes[fixes.length - 1].t,
    tEndPrec: Prec.hour,
    lon: round(wrap(p.lon)),
    lat: round(p.lat),
    // The R*Tree box can't span 180°; such a track is found by its peak only.
    bbox: line.length > 1 && !crosses
      ? { w: Math.min(...line.map(c => c[0])), s: Math.min(...line.map(c => c[1])), e: Math.max(...line.map(c => c[0])), n: Math.max(...line.map(c => c[1])) }
      : null,
    geom: line.length > 1 ? toWkb({ type: 'LineString', coordinates: line }) : null,
    geoPrec: GeoPrec.area,
    // The hazard family draws and labels magnitude as a quake's, so the category stays in attrs (as GVP's VEI does).
    magnitude: null,
    confidence: provisional ? 0.8 : 1,
    attrs: {
      max_wind_kt: wind,
      wind_measured_by: agency ? (AGENCIES[agency] ?? agency) : null,
      min_pressure_hpa: pressures.length ? Math.min(...pressures) : null,
      category: top !== null ? SSHS[top] : null,
      basin: [BASINS[p.basin] ?? p.basin, SUBBASINS[p.sub]].filter(Boolean).join(', '),
      ...(basins.length > 1 && { basins: basins.map(b => BASINS[b]) }),
      peak_at: new Date(p.t).toISOString().slice(0, 16).replace('T', ' '),
      ...(provisional && { provisional: true }),
      placed_at: peak.by,
      ids: { ibtracs: s.sid, ...(s.atcf && { atcf: s.atcf }) },
      url: `https://ncics.org/ibtracs/index.php?name=v04r01-${s.sid}`,
    },
  };
}

/**
 * IBTrACS v04r01 (NOAA NCEI, public domain): every tropical cyclone's best track since 1842, merged from the
 * world's agencies. Spur tracks, alternates of a main track, are left out. GDIS storms aren't linked: they carry
 * no storm name and only a year.
 */
export async function importIbtracs(ctx: Ctx) {
  await importDataset(ctx, { source: 'ibtracs', version: VERSION, asOf: AS_OF, files: [FILE], importerVersion: '1' }, async ds => {
    const rep = ds.report;
    const batch = new EventBatch(ctx, ds);
    const by: Record<string, number> = {};
    let n = 0;
    for await (const s of storms(FILE, rep)) {
      rep.rows += s.fixes.length;
      n++;
      if (s.trackType.includes('spur')) {
        rep.reject('spur track (an alternate of a main track)', s.sid);
        continue;
      }
      if (!s.fixes.length) continue;
      const e = stormEvent(s);
      by[e.attrs!.placed_at as string] = (by[e.attrs!.placed_at as string] ?? 0) + 1;
      batch.add(e);
    }
    rep.extra.storms = n;
    rep.extra.placed = by;
    return batch.finish();
  });
}

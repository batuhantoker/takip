import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { type EventInput, GeoPrec } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE, type Reporter } from '../context';
import { num, readCsv } from '../csv';
import { utc } from '../dates';
import { EventBatch, validLonLat } from '../events';

export const GDIS_CSV = join(RAW_MORE, 'gdis', 'pend-gdis-1960-2018-disasterlocations.csv');
const AS_OF = '2021-04-14';

/** EM-DAT's disaster types as GDIS spells them, trimmed: the file has "extreme temperature ". */
const TYPES: Record<string, { kind: string; label: string }> = {
  flood: { kind: 'disaster.flood', label: 'Flood' },
  storm: { kind: 'disaster.storm', label: 'Storm' },
  'extreme temperature': { kind: 'disaster.temperature', label: 'Extreme temperature' },
  drought: { kind: 'disaster.drought', label: 'Drought' },
  earthquake: { kind: 'disaster.quake', label: 'Earthquake' },
  landslide: { kind: 'disaster.landslide', label: 'Landslide' },
  'mass movement (dry)': { kind: 'disaster.mass_movement', label: 'Landslide (dry)' },
  'volcanic activity': { kind: 'disaster.volcano', label: 'Volcanic activity' },
};

/** A disaster whose places lie farther than this from their middle is drawn hollow. */
const SPREAD_KM = 1000;

/** Places GDIS puts in the wrong spot, by "country|geolocation". */
const FIXES: Record<string, [lon: number, lat: number]> = {
  // Geocoded to Paraguay's Cordillera department; this is the Cordillera Administrative Region.
  'Philippines|Cordillera': [121.0, 17.35],
  // Centroids of provinces that cross 180°, averaged across it.
  'Fiji|Lau': [-178.8, -18.32],
  'Fiji|Cakaudrove': [179.6, -16.64],
  'Fiji|Northern': [179.4, -16.62],
};

type Place = { name: string; adm1: string; level: number; lon: number; lat: number };
type Group = { no: string; country: string; type: (typeof TYPES)[string]; years: number[]; places: Map<string, Place>; then: string | null };
export type GdisEvent = Omit<EventInput, 'sourceId' | 'datasetId'>;

/** A few names went through UTF-8 → Latin-1 → UTF-8 before export ("StÅ\u0093Ng Treng"). */
export const cleanName = (s: string) =>
  (/[\u0080-\u009f]/.test(s) ? Buffer.from(s, 'latin1').toString('utf8') : s).replace(/\s+/g, ' ').trim();

/** The mean of points, unwrapped across 180° when they straddle it. */
export function middle(pts: [number, number][]): [number, number] {
  const lons = pts.map(p => p[0]);
  const wrap = Math.max(...lons) - Math.min(...lons) > 180;
  const lon = pts.reduce((s, p) => s + (wrap && p[0] < 0 ? p[0] + 360 : p[0]), 0) / pts.length;
  return [lon > 180 ? lon - 360 : lon, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

const km = (lon1: number, lat1: number, lon2: number, lat2: number) => {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
};

const round = (x: number) => Math.round(x * 1e4) / 1e4;

/**
 * One event per disaster and country (EM-DAT's own unit), at the middle of the places it hit, which stay in
 * attrs; a disaster that crossed borders links its countries as `related`.
 */
export function gdisEvents(rows: Record<string, string>[], rep: Reporter): { events: GdisEvent[]; links: [string, string][] } {
  const groups = new Map<string, Group>();
  for (const r of rows) {
    rep.rows++;
    const type = TYPES[r.disastertype?.trim()];
    const year = num(r.year);
    const name = cleanName(r.geolocation ?? '');
    const [lon, lat] = FIXES[`${r.country}|${name}`] ?? [num(r.longitude), num(r.latitude)];
    if (!type) {
      rep.reject(`type ${r.disastertype}`, r.disasterno);
      continue;
    }
    if (year === null || !validLonLat(lon, lat)) {
      rep.reject('no year or coordinates', `${r.disasterno} ${name}`);
      continue;
    }
    const key = `${r.disasterno}:${r.country}`;
    const g: Group = groups.get(key) ?? { no: r.disasterno, country: r.country, type, years: [], places: new Map(), then: null };
    g.years.push(year);
    const adm1 = cleanName(r.adm1 ?? '');
    // A place can be listed twice, with centroids a few hundred metres apart.
    if (!g.places.has(`${adm1}|${name}`)) g.places.set(`${adm1}|${name}`, { name, adm1, level: num(r.level) ?? 1, lon: lon!, lat: lat! });
    if (r.historical === '1' && r.hist_country && r.hist_country !== 'NA') g.then = r.hist_country;
    groups.set(key, g);
  }

  const countries = new Map<string, string[]>();
  for (const [key, g] of groups) countries.set(g.no, [...(countries.get(g.no) ?? []), key]);

  const events: GdisEvent[] = [];
  for (const [key, g] of groups) {
    const places = [...g.places.values()];
    const [lon, lat] = middle(places.map(p => [p.lon, p.lat]));
    const spread = Math.max(...places.map(p => km(lon, lat, p.lon, p.lat)));
    const geoPrec = places.length === 1
      ? (places[0].level === 3 ? GeoPrec.city : GeoPrec.area)
      : spread > SPREAD_KM ? GeoPrec.approximate : GeoPrec.area;
    const regions = [...new Set(places.filter(p => p.level > 1).map(p => p.adm1))];
    const where = places.length === 1
      ? `${places[0].name}, ${g.country}`
      : regions.length === 1 && places.every(p => p.level > 1) ? `${regions[0]}, ${g.country}` : g.country;
    const lo = Math.min(...g.years);
    const hi = Math.max(...g.years);
    events.push({
      kind: g.type.kind,
      sourceRecordId: key,
      title: `${g.type.label} — ${where}`,
      tStart: utc(lo),
      tStartPrec: Prec.year,
      tEnd: hi > lo ? utc(hi) : null,
      tEndPrec: hi > lo ? Prec.year : null,
      lon,
      lat,
      geoPrec,
      magnitude: places.length,
      attrs: {
        where: places.map(p => p.name),
        region: regions.length ? regions : null,
        also_hit: countries.get(g.no)!.filter(k => k !== key).map(k => groups.get(k)!.country),
        country_then: g.then,
        disaster_no: g.no,
        places_at: places.map(p => [round(p.lon), round(p.lat)]),
      },
    });
  }

  const links: [string, string][] = [];
  for (const keys of countries.values()) for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) links.push([keys[i], keys[j]]);
  rep.extra.disasters = countries.size;
  return { events, links };
}

/** GDIS (Rosvold & Buhaug 2021): where EM-DAT's floods, storms, quakes, droughts and the rest struck, 1960–2018, by year. */
export async function importGdis(ctx: Ctx) {
  await importDataset(ctx, { source: 'gdis', version: '1.00', asOf: AS_OF, files: [GDIS_CSV], importerVersion: '1' }, async ds => {
    const { events, links } = gdisEvents(await readCsv(GDIS_CSV), ds.report);
    const batch = new EventBatch(ctx, ds);
    for (const e of events) batch.add(e);
    const publish = batch.finish();
    ctx.events.clearRelations(ds.sourceId);
    let related = 0;
    ctx.history.transaction(() => {
      for (const [a, b] of links) {
        const from = ctx.events.eventId(ds.sourceId, a);
        const to = ctx.events.eventId(ds.sourceId, b);
        if (from === undefined || to === undefined) continue;
        ctx.events.relate(from, 'related', to, 1, ds.sourceId);
        related++;
      }
    })();
    ds.report.extra.links = { related };
    return publish;
  });
}

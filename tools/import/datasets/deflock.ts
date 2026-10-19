import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Ctx, importDataset } from '../context';
import { DEFLOCK_DIR } from '../fetch-places';
import { layerFeatures, polygonLocator } from '../layers';
import { buildLayer } from './geo';
import type { CountyProps } from './us-counties';
import type { UsPlaceProps } from './us-places';

/*
 * Licence-plate readers (ALPR) mapped on OpenStreetMap, from DeFlock's region files (ODbL), worldwide: the `alpr`
 * layer. Makers and operators are folded to one spelling and bearings parsed; the raw tags stay beside them. Readers
 * in the US get their county and Census place from the us-counties and us-places layers, so import those first.
 */

export const FLOCK = 'Flock Safety';
const MAX_BEARINGS = 4;
const LONGEST_NAME = 60;

type Raw = { id: number; lat: number; lon: number; tags: Record<string, string | undefined> };

export type AlprProps = {
  maker?: string;
  operator?: string;
  /** Mapped bearings, degrees from north. */
  dirs?: number[];
  /** The US county's GEOID. */
  county?: string;
  /** The US Census place's GEOID: an incorporated city or town, or a CDP. */
  place?: string;
  tags: Record<string, string>;
};

const CARDINAL = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const norm = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;

/** "185;70", "338-23" (a span: its middle), "-30", "NE"; "0-360", "forward" and the like say nothing. */
export function bearings(...values: (string | undefined)[]): number[] {
  const out = new Set<number>();
  for (const value of values) {
    for (const part of (value ?? '').split(';')) {
      const s = part.trim().toUpperCase();
      const span = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(s);
      if (span) {
        const from = Number(span[1]);
        const width = (((Number(span[2]) - from) % 360) + 360) % 360;
        if (width > 0 && width < 180) out.add(norm(from + width / 2));
      } else if (/^-?\d+(\.\d+)?$/.test(s)) out.add(norm(Number(s)));
      else if (CARDINAL.includes(s)) out.add(norm(CARDINAL.indexOf(s) * 22.5));
    }
  }
  return [...out].slice(0, MAX_BEARINGS);
}

/** Makers mapped under several spellings ("flock", "Flock Group Inc.", "Motorola Solutions(Vigilant)"). */
const MAKERS: [RegExp, string][] = [
  [/^flock/i, FLOCK], [/^motorola/i, 'Motorola Solutions'], [/^axis\b/i, 'Axis Communications'], [/^genetec/i, 'Genetec'],
  [/^axon/i, 'Axon'], [/^rekor/i, 'Rekor'], [/^leonardo/i, 'Leonardo'], [/^neology/i, 'Neology'], [/^platesmart/i, 'PlateSmart'],
  [/^ubicquia/i, 'Ubicquia'], [/^hikvision/i, 'Hikvision'], [/^verkada/i, 'Verkada'], [/^avigilon/i, 'Avigilon'],
];
export const knownMaker = (s: string) => MAKERS.find(([re]) => re.test(s))?.[1];

/** The first of several values, without "(installation in progress)" or a doubtful "?"; overlong notes are dropped. */
export const cleanName = (v: string | undefined) => {
  const s = v?.split(';')[0].replace(/\(.*?\)/g, '').replace(/\?+$/, '').replace(/\s+/g, ' ').trim();
  return s && s.length <= LONGEST_NAME ? s : undefined;
};

/** Merges case variants ("Axis communications") into the spelling mapped most often. */
function spellings(values: (string | undefined)[]): (v: string | undefined) => string | undefined {
  const seen = new Map<string, Map<string, number>>();
  for (const v of values) {
    if (!v) continue;
    const forms = seen.get(v.toLowerCase()) ?? new Map<string, number>();
    forms.set(v, (forms.get(v) ?? 0) + 1);
    seen.set(v.toLowerCase(), forms);
  }
  const best = new Map([...seen].map(([key, forms]) => [key, [...forms].sort((a, b) => b[1] - a[1])[0][0]]));
  return v => (v ? best.get(v.toLowerCase()) : undefined);
}

const rawMaker = (t: Raw['tags']) => {
  const m = cleanName(t.manufacturer ?? t.brand ?? t['surveillance:brand'] ?? t['surveillance:manufacturer']);
  return m && (knownMaker(m) ?? m);
};
const rawOperator = (t: Raw['tags']) => cleanName(t.operator ?? t['surveillance:operator']);

export async function importDeflock(ctx: Ctx) {
  const files = readdirSync(DEFLOCK_DIR).filter(f => f.endsWith('.json')).sort().map(f => join(DEFLOCK_DIR, f));
  const index = JSON.parse(readFileSync(join(DEFLOCK_DIR, 'index.json'), 'utf8')) as { tile_url: string };
  // The version is when DeFlock last read OpenStreetMap, in epoch seconds.
  const version = Number(/[?&]v=(\d+)/.exec(index.tile_url)?.[1]);
  if (!version) throw new Error('deflock: no version in index.json; run `npx tsx tools/import/fetch.ts deflock`');
  await importDataset(ctx, { source: 'deflock-alpr', version: String(version), asOf: new Date(version * 1000).toISOString(), files, importerVersion: '2' }, async ds => {
    const byId = new Map<number, Raw>();
    for (const f of files) if (!f.endsWith('index.json')) for (const r of JSON.parse(readFileSync(f, 'utf8')) as Raw[]) byId.set(r.id, r);
    const readers = [...byId.values()];
    const counties = layerFeatures(ctx.layout, ctx.catalog, 'us-counties');
    const places = layerFeatures(ctx.layout, ctx.catalog, 'us-places');
    if (!counties || !places) ctx.log('deflock-alpr: no us-counties or us-places layer yet, so some readers carry no county or place');
    const countyAt = counties ? polygonLocator<CountyProps>(counties) : () => undefined;
    const placeAt = places ? polygonLocator<UsPlaceProps>(places) : () => undefined;
    const makerOf = spellings(readers.map(r => rawMaker(r.tags)));
    const operatorOf = spellings(readers.map(r => rawOperator(r.tags)));
    let inCounty = 0;
    let inPlace = 0;
    await buildLayer(ctx, ds, { code: 'alpr', geomKind: 'point', timeMode: 'static', tileProps: ['maker', 'operator'], minzoom: 3 }, async w => {
      for (const r of readers) {
        ds.report.rows++;
        if (!Number.isFinite(r.lon) || !Number.isFinite(r.lat)) {
          ds.report.reject('no position', String(r.id));
          continue;
        }
        const op = rawOperator(r.tags);
        // "operator=Flock Safety" is usually the maker tagged in the wrong key.
        const opAsMaker = op && knownMaker(op);
        const dirs = bearings(r.tags.direction, r.tags['camera:direction']);
        const county = countyAt([r.lon, r.lat])?.geoid;
        const place = county ? placeAt([r.lon, r.lat])?.geoid : undefined;
        if (county) inCounty++;
        if (place) inPlace++;
        const props: AlprProps = {
          maker: makerOf(rawMaker(r.tags)) ?? opAsMaker,
          operator: opAsMaker ? undefined : operatorOf(op),
          ...(dirs.length ? { dirs } : {}),
          ...(county ? { county } : {}),
          ...(place ? { place } : {}),
          tags: Object.fromEntries(Object.entries(r.tags).filter((e): e is [string, string] => typeof e[1] === 'string')),
        };
        w.add({ sourceRecordId: `node/${r.id}`, props, geom: { type: 'Point', coordinates: [r.lon, r.lat] } });
      }
    });
    ds.report.extra.inUsCounty = inCounty;
    ds.report.extra.inUsPlace = inPlace;
    return {};
  });
}

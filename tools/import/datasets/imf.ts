import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import type { MetricInput } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE } from '../context';
import { csvRecords, num } from '../csv';
import { utc } from '../dates';
import { Resolver } from '../resolver';
import { SeriesBatch } from '../series';

/*
 * IMF World Economic Outlook, October 2026, from the full-dataset CSV a person downloads at
 * https://data.imf.org/en/datasets/IMF.RES:WEO (fetch.ts `imf` says how). The IMF's terms forbid automated bulk
 * download and need written permission for commercial reuse ("© IMF … All Rights Reserved"): personal use until it
 * agrees. Each series names its own last actual year (LATEST_ACTUAL_ANNUAL_DATA); later years are IMF projections.
 * The portal's file is wide (a column per year, codes in SERIES_CODE); the API's SDMX-CSV is long; both are read.
 */

export const DIR = join(RAW_MORE, 'imf');
const AS_OF = '2026-10-13';

type ImfMetric = MetricInput & { indicator: string };
/** PPP GDP per person is left out: the IMF gives it no last actual year, so its projections couldn't be told apart. */
export const IMF_METRICS: ImfMetric[] = [
  { indicator: 'NGDP_RPCH', code: 'imf:NGDP_RPCH', name: 'Real GDP growth (IMF WEO)', unit: '%', topic: 'economy', granularity: 'year' },
  { indicator: 'NGDPDPC', code: 'imf:NGDPDPC', name: 'GDP per person, current US$ (IMF WEO)', unit: 'US$', topic: 'economy', granularity: 'year' },
  { indicator: 'PCPIPCH', code: 'imf:PCPIPCH', name: 'Inflation, average consumer prices (IMF WEO)', unit: '%', topic: 'economy', granularity: 'year' },
  { indicator: 'LUR', code: 'imf:LUR', name: 'Unemployment rate (IMF WEO)', unit: '% of labour force', topic: 'economy', granularity: 'year' },
  { indicator: 'GGXWDG_NGDP', code: 'imf:GGXWDG_NGDP', name: 'Government gross debt (IMF WEO)', unit: '% of GDP', topic: 'economy', granularity: 'year' },
  { indicator: 'LP', code: 'imf:LP', name: 'Population (IMF WEO)', unit: 'people', agg: 'sum', topic: 'population', granularity: 'year' },
];

export const projectionOf = (m: ImfMetric): ImfMetric => ({ ...m, code: `${m.code}.proj`, name: m.name.replace('(IMF WEO)', '(IMF projection, October 2026)'), attrs: { projection: true, base: m.code } });

/** "2025", or a fiscal year such as "FY2025/26", which the WEO files under its first calendar year. */
export const lastActual = (v: string | undefined) => {
  const m = /^(?:FY)?(\d{4})/.exec(v?.trim() ?? '');
  return m ? Number(m[1]) : null;
};

/** The IMF's own code where it isn't ISO's. */
const ISO3: Record<string, string> = { KOS: 'XKX' };

/** The portal writes SCALE as a word, the API as a power of ten. */
const SCALES: Record<string, number> = { Units: 0, Thousands: 3, Millions: 6, Billions: 9 };

type Series = { country: string; indicator: string; frequency: string; scale: number; last: number | null; points: [number, number][] };

/** One series from a row: wide ("SYR.LP.A" and a column per year) or long (one TIME_PERIOD and OBS_VALUE). */
export function seriesOf(row: Record<string, string>): Series | null {
  const scale = SCALES[row.SCALE] ?? num(row.SCALE) ?? 0;
  const last = lastActual(row.LATEST_ACTUAL_ANNUAL_DATA);
  if (row.SERIES_CODE) {
    const parts = row.SERIES_CODE.split('.');
    if (parts.length < 3) return null;
    const points = Object.keys(row).filter(k => /^\d{4}$/.test(k)).flatMap((y): [number, number][] => {
      const v = num(row[y]);
      return v === null ? [] : [[Number(y), v]];
    });
    return { country: parts[0], indicator: parts.slice(1, -1).join('.'), frequency: parts.at(-1)!, scale, last, points };
  }
  const v = num(row.OBS_VALUE);
  const year = Number(row.TIME_PERIOD);
  if (v === null || !Number.isInteger(year)) return null;
  return { country: row.COUNTRY, indicator: row.INDICATOR, frequency: row.FREQUENCY, scale, last, points: [[year, v]] };
}

/** The one CSV the person downloaded, if there is exactly one. */
export function imfFile() {
  const csv = existsSync(DIR) ? readdirSync(DIR).filter(f => f.toLowerCase().endsWith('.csv')) : [];
  return csv.length === 1 ? join(DIR, csv[0]) : null;
}

export async function importImf(ctx: Ctx) {
  const file = imfFile();
  if (!file) {
    ctx.log(`imf-weo: skipped; put the WEO full-dataset CSV (one file) in ${DIR}, see \`npx tsx tools/import/fetch.ts imf\``);
    return;
  }
  await importDataset(ctx, { source: 'imf-weo', version: 'October 2026', asOf: AS_OF, files: [file], importerVersion: '2' }, async ds => {
    const rep = ds.report;
    const r = new Resolver(ctx);
    const batch = new SeriesBatch(ctx, ds);
    const metrics = new Map(IMF_METRICS.map(m => [m.indicator, { id: batch.metric(m), projected: batch.metric(projectionOf(m)) }]));
    for await (const row of csvRecords(file)) {
      if (row.__header__) continue;
      const s = seriesOf(row);
      const m = s && s.frequency === 'A' ? metrics.get(s.indicator) : undefined;
      if (!s || !m || !s.points.length) continue;
      const subject = r.resolve('iso3', ISO3[s.country] ?? s.country, utc(s.points[0][0]));
      if (subject === undefined || s.last === null) {
        rep.reject(subject === undefined ? 'a group, or no polity for the code' : 'no last actual year', `${s.country} ${s.indicator}`);
        continue;
      }
      rep.rows++;
      for (const [year, v] of s.points) {
        batch.add(year > s.last ? m.projected : m.id, 'entity', subject, { t: utc(year), prec: Prec.year, v: v * 10 ** s.scale });
      }
    }
    return batch.finish();
  });
}

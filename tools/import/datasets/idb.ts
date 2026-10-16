import { createReadStream, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Prec } from '@takip/core/time';
import type { MetricInput } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE } from '../context';
import { num } from '../csv';
import { utc } from '../dates';
import { Resolver } from '../resolver';
import { SeriesBatch } from '../series';

/*
 * US Census Bureau International Database (CC0, per its API metadata): fetch.ts `idb`. Every value from a country's
 * base year on is the cohort-component model, checked against data up to its last estimates-and-projections revision;
 * so years after that revision (census.gov's "countries and areas" table) are marked as Census projections.
 */

const DIR = join(RAW_MORE, 'idb');
const DATA = join(DIR, 'idb5yr.txt');
const REVISIONS = join(DIR, 'countries-and-areas.html');
const AS_OF = '2025-12-01';
/** Countries; the other GEO_ID prefixes are subnational, 2015–2030 only. */
const COUNTRY = 'W140000WO';
/** GENC-2 codes for the Gaza Strip and the West Bank: two values that one shape (Palestine) can't show. */
const SPLIT = new Set(['XG', 'XW']);

type IdbMetric = MetricInput & { column: string };
export const IDB_METRICS: IdbMetric[] = [
  { column: 'POP', code: 'idb:POP', name: 'Population (US Census IDB)', unit: 'people', agg: 'sum', topic: 'population', granularity: 'year' },
  { column: 'TFR', code: 'idb:TFR', name: 'Fertility rate (US Census IDB)', unit: 'live births per woman', topic: 'population', granularity: 'year' },
  { column: 'E0', code: 'idb:E0', name: 'Life expectancy at birth (US Census IDB)', unit: 'years', topic: 'health', granularity: 'year' },
  { column: 'IMR', code: 'idb:IMR', name: 'Infant mortality rate (US Census IDB)', unit: 'infant deaths per 1,000 live births', topic: 'health', granularity: 'year' },
  { column: 'MEDAGE', code: 'idb:MEDAGE', name: 'Median age (US Census IDB)', unit: 'years', topic: 'population', granularity: 'year' },
];

export const projectionOf = (m: IdbMetric): IdbMetric => ({ ...m, code: `${m.code}.proj`, name: m.name.replace('(US Census IDB)', '(US Census projection)'), attrs: { projection: true, base: m.code } });

/** GENC-2 → the last year still estimated. "2025 *" (the US) marks 2025 on as projected, so its last estimate is 2024. */
export function lastEstimates(html: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const [, row] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => c[1].replace(/<[^>]+>/g, '').trim());
    const m = cells.length === 3 ? /^(\d{4})\s*(\*)?$/.exec(cells[2]) : null;
    if (m) out.set(cells[0], Number(m[1]) - (m[2] ? 1 : 0));
  }
  return out;
}

export async function importIdb(ctx: Ctx) {
  await importDataset(ctx, { source: 'census-idb', version: 'December 2025', asOf: AS_OF, files: [DATA, REVISIONS], importerVersion: '1' }, async ds => {
    const rep = ds.report;
    const r = new Resolver(ctx);
    const batch = new SeriesBatch(ctx, ds);
    const metrics = IDB_METRICS.map(m => ({ ...m, id: batch.metric(m), projected: batch.metric(projectionOf(m)) }));
    const last = lastEstimates(readFileSync(REVISIONS, 'utf8'));
    let header: string[] | null = null;
    for await (const raw of createInterface({ input: createReadStream(DATA), crlfDelay: Infinity })) {
      const line = raw.replace(/\r$/, '');
      if (!header) {
        header = line.replace(/^#/, '').split('|');
        continue;
      }
      const cells = line.split('|');
      const row = Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
      if (!row.GEO_ID.startsWith(COUNTRY)) continue;
      const genc = row.GEO_ID.slice(COUNTRY.length);
      const year = Number(row.YR);
      if (SPLIT.has(genc)) {
        rep.reject('reported as two areas, drawn as one', genc);
        continue;
      }
      const estimatedTo = last.get(genc);
      const t = utc(year);
      const subject = r.resolve('iso2', genc, t);
      if (subject === undefined || estimatedTo === undefined || !Number.isInteger(year)) {
        rep.reject(subject === undefined ? 'no polity for the GENC-2 code' : 'no revision year', genc);
        continue;
      }
      rep.rows++;
      for (const m of metrics) batch.add(year > estimatedTo ? m.projected : m.id, 'entity', subject, { t, prec: Prec.year, v: num(row[m.column]) });
    }
    rep.extra.revisions = last.size;
    return batch.finish();
  });
}

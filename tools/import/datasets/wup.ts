import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import type { MetricInput } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE } from '../context';
import { csvRecords, num } from '../csv';
import { utc } from '../dates';
import { Resolver } from '../resolver';
import { SeriesBatch } from '../series';

/*
 * UN World Urbanization Prospects 2025 (CC BY 3.0 IGO): fetch.ts `wup`. "Annual population estimates for the
 * period 1950–2025 … and projections up to 2050" (WUP FAQ); the files don't mark which is which, the year does.
 */

const DIR = join(RAW_MORE, 'wup');
export const NATIONAL = 'WUP2025-DB-National-Definitions-Population-Data.csv.gz';
export const DEGURBA = 'WUP2025-DB-DEGURBA-Level1-Population-Surface-Data.csv.gz';
const AS_OF = '2025-11-01';
export const LAST_ESTIMATE = 2025;
const COUNTRY = '4';

type WupMetric = MetricInput & { file: string; category: string; column: string; scale?: number };

/** National definitions differ by country; the degree of urbanisation (cities, towns, rural) is one method for all. */
export const WUP_METRICS: WupMetric[] = [
  { file: NATIONAL, category: 'Urban', column: 'percPop', code: 'wup:UrbanShare', name: 'Urban population, share (national definitions)', unit: '%', topic: 'population', granularity: 'year' },
  { file: NATIONAL, category: 'Urban', column: 'Pop', code: 'wup:UrbanPop', name: 'Urban population (national definitions)', unit: 'people', agg: 'sum', scale: 1000, topic: 'population', granularity: 'year' },
  { file: DEGURBA, category: 'Cities', column: 'percPop', code: 'wup:CityShare', name: 'People living in cities (degree of urbanisation)', unit: '%', topic: 'population', granularity: 'year' },
  { file: DEGURBA, category: 'Towns', column: 'percPop', code: 'wup:TownShare', name: 'People living in towns (degree of urbanisation)', unit: '%', topic: 'population', granularity: 'year' },
  { file: DEGURBA, category: 'Rural', column: 'percPop', code: 'wup:RuralShare', name: 'People living in rural areas (degree of urbanisation)', unit: '%', topic: 'population', granularity: 'year' },
];

/** Under its own code so the API never serves it as the default source; projection.ts names it for History. */
export const projectionOf = (m: WupMetric): WupMetric => ({
  ...m,
  code: `${m.code}.proj`,
  name: `${m.name} (UN projection)`,
  attrs: { projection: true, base: m.code },
});

export async function importWup(ctx: Ctx) {
  const files = [join(DIR, NATIONAL), join(DIR, DEGURBA)];
  await importDataset(ctx, { source: 'wup-2025', version: 'WUP 2025', asOf: AS_OF, files, importerVersion: '1' }, async ds => {
    const rep = ds.report;
    const r = new Resolver(ctx);
    const batch = new SeriesBatch(ctx, ds);
    for (const file of [NATIONAL, DEGURBA]) {
      const metrics = WUP_METRICS.filter(m => m.file === file).map(m => ({ ...m, id: batch.metric(m), projected: batch.metric(projectionOf(m)) }));
      for await (const row of csvRecords(join(DIR, file))) {
        if (row.__header__ || row.LocType !== COUNTRY) continue;
        const year = Number(row.Year);
        // Label and separator rows have no year.
        if (!row.Year || !Number.isInteger(year)) continue;
        const here = metrics.filter(m => m.category === row.Category);
        if (!here.length) continue;
        const t = utc(year);
        const subject = r.resolve('iso3', row.ISO3_Code, t);
        if (subject === undefined) {
          rep.reject('no polity for the ISO3 code', row.ISO3_Code);
          continue;
        }
        rep.rows++;
        for (const m of here) {
          const v = num(row[m.column]);
          batch.add(year > LAST_ESTIMATE ? m.projected : m.id, 'entity', subject, { t, prec: Prec.year, v: v === null ? null : v * (m.scale ?? 1) });
        }
      }
      batch.flush();
    }
    return batch.finish();
  });
}

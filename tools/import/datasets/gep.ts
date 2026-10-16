import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { type Ctx, importDataset, RAW_MORE } from '../context';
import { csvRecords, num } from '../csv';
import { utc } from '../dates';
import { Resolver } from '../resolver';
import { SeriesBatch } from '../series';

/*
 * World Bank Global Economic Prospects, June 2026 (CC BY 4.0): fetch.ts `gep`. The publication marks 2025 as an
 * estimate ("2025e") and 2026–2028 as forecasts ("f"), the same years for every economy; the CSV doesn't, so the
 * year decides.
 */

const FILE = join(RAW_MORE, 'gep', 'GEPCSV.csv');
const AS_OF = '2026-06-09';
export const LAST_ESTIMATE = 2025;
export const GEP_METRIC = { code: 'gep:NYGDPMKTPKDZ', name: 'Real GDP growth (World Bank GEP)', unit: '%', topic: 'economy', granularity: 'year' } as const;
export const GEP_FORECAST = { ...GEP_METRIC, code: `${GEP_METRIC.code}.proj`, name: 'Real GDP growth (World Bank forecast, June 2026)', attrs: { projection: true, base: GEP_METRIC.code } };

export async function importGep(ctx: Ctx) {
  await importDataset(ctx, { source: 'wb-gep', version: 'June 2026', asOf: AS_OF, files: [FILE], importerVersion: '1' }, async ds => {
    const rep = ds.report;
    const r = new Resolver(ctx);
    const batch = new SeriesBatch(ctx, ds);
    const base = batch.metric(GEP_METRIC);
    const forecast = batch.metric(GEP_FORECAST);
    for await (const row of csvRecords(FILE)) {
      if (row.__header__ || row['Indicator Code'] !== 'NYGDPMKTPKDZ') continue;
      const years = Object.keys(row).filter(k => /^\d{4}$/.test(k));
      const subject = r.resolveAny([['wb', row['Country Code']], ['iso3', row['Country Code']]], utc(Number(years[0])));
      if (subject === undefined) {
        rep.reject('an aggregate, or no polity for the code', row['Country Code']);
        continue;
      }
      rep.rows++;
      for (const y of years) {
        const year = Number(y);
        batch.add(year > LAST_ESTIMATE ? forecast : base, 'entity', subject, { t: utc(year), prec: Prec.year, v: num(row[y]) });
      }
    }
    return batch.finish();
  });
}

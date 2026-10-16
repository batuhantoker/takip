import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import type { MetricInput } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE } from '../context';
import { csvRecords, num } from '../csv';
import { utc } from '../dates';
import { Resolver } from '../resolver';
import { SeriesBatch } from '../series';

/*
 * OECD Economic Outlook 117 long-term scenarios (OECD data terms: any use with attribution): fetch.ts `oecd-lt`.
 * Nothing in the data marks history: the six scenarios agree to 2026 and CO₂ history ends in 2023, so everything from
 * 2024 is treated as the scenario, which marks a real 2024 value as projected rather than the reverse.
 */

const DIR = join(RAW_MORE, 'oecd-lt');
const AS_OF = '2025-06-03';
export const LAST_HISTORY = 2023;
export const OECD_LT_MEASURES = ['GDPVD_CAP', 'CO2'] as const;

/** The main scenario is `.proj`, the others `.proj.<id>`; projection.ts names them for History. */
export const SCENARIOS: Record<string, string> = { BAU1: '', BAU2: 'bau2', ET1: 'et1', ET2: 'et2', ET3: 'et3', ET4: 'et4' };

type Measure = MetricInput & { measure: string };
export const OECD_LT_METRICS: Measure[] = [
  { measure: 'GDPVD_CAP', code: 'oecd-lt:GDPVD_CAP', name: 'GDP per person, constant PPP (OECD long-term)', unit: 'US$ (PPP)', topic: 'economy', granularity: 'year' },
  // UNIT_MULT says 0, but the values are millions of tonnes (the US in 2023: 4,911).
  { measure: 'CO2', code: 'oecd-lt:CO2', name: 'CO₂ emissions, gross (OECD long-term)', unit: 'Mt CO₂', agg: 'sum', topic: 'environment', granularity: 'year' },
];

export const scenarioCode = (m: Measure, scenario: string) => `${m.code}.proj${SCENARIOS[scenario] ? `.${SCENARIOS[scenario]}` : ''}`;

export async function importOecdLt(ctx: Ctx) {
  const files = OECD_LT_MEASURES.map(m => join(DIR, `${m}.csv`));
  await importDataset(ctx, { source: 'oecd-lt-eo117', version: 'EO117', asOf: AS_OF, files, importerVersion: '1' }, async ds => {
    const rep = ds.report;
    const r = new Resolver(ctx);
    const batch = new SeriesBatch(ctx, ds);
    for (const m of OECD_LT_METRICS) {
      const base = batch.metric(m);
      const ids = Object.fromEntries(Object.keys(SCENARIOS).map(s => [s, batch.metric({
        ...m, code: scenarioCode(m, s), name: `${m.name.replace(' (OECD long-term)', '')} (OECD long-term scenario ${s})`, attrs: { projection: true, scenario: s, base: m.code },
      })]));
      for await (const row of csvRecords(join(DIR, `${m.measure}.csv`))) {
        if (row.__header__ || row.MEASURE !== m.measure || !ids[row.SCENARIO]) continue;
        const year = Number(row.TIME_PERIOD);
        // History is the same in every scenario; BAU1's copy is kept.
        if (!Number.isInteger(year) || (year <= LAST_HISTORY && row.SCENARIO !== 'BAU1')) continue;
        const t = utc(year);
        const subject = r.resolve('iso3', row.REF_AREA, t);
        if (subject === undefined) {
          rep.reject('a group, or no polity for the code', row.REF_AREA);
          continue;
        }
        rep.rows++;
        batch.add(year > LAST_HISTORY ? ids[row.SCENARIO] : base, 'entity', subject, { t, prec: Prec.year, v: num(row.OBS_VALUE) });
      }
      batch.flush();
    }
    return batch.finish();
  });
}

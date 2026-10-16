import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import type { MetricInput } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE } from '../context';
import { utc } from '../dates';
import { CCKP_ERA5, CCKP_VARS } from '../fetch';
import { Resolver } from '../resolver';
import { SeriesBatch } from '../series';

/*
 * World Bank Climate Change Knowledge Portal (CC BY 4.0): fetch.ts `cckp`. Country means of the CMIP6 ensemble,
 * bias-adjusted to ERA5: its historical run (1950–2014) and five SSPs (2015–2100), joined the way the portal charts
 * them. For counts such as hot or rainy days the models' median sits well off ERA5 (a third fewer days of heavy rain),
 * so observations followed by models would show a jump that never happened; ERA5 is kept as a metric of its own.
 */

const DIR = join(RAW_MORE, 'cckp');
const AS_OF = '2026-10-16';

/** The main scenario is `.proj`, the rest `.proj.<ssp>`; projection.ts names them for History. */
export const SSPS = ['ssp245', 'ssp119', 'ssp126', 'ssp370', 'ssp585'] as const;
const MAIN = 'ssp245';
const SSP_NAMES: Record<string, string> = { ssp119: 'SSP1-1.9', ssp126: 'SSP1-2.6', ssp245: 'SSP2-4.5', ssp370: 'SSP3-7.0', ssp585: 'SSP5-8.5' };
/** The models' spread: `.lo` and `.hi` beside each scenario's median. */
const BOUNDS = [['p10', 'lo'], ['p90', 'hi']] as const;

type Var = { v: string; name: string; unit: string };
export const CCKP_METRICS: Var[] = [
  { v: 'tas', name: 'Mean temperature', unit: '°C' },
  { v: 'txx', name: 'Hottest day of the year', unit: '°C' },
  { v: 'hd35', name: 'Days above 35 °C', unit: 'days' },
  { v: 'hd40', name: 'Days above 40 °C', unit: 'days' },
  { v: 'tr', name: 'Tropical nights (low above 20 °C)', unit: 'nights' },
  { v: 'pr', name: 'Precipitation', unit: 'mm per year' },
  { v: 'r20mm', name: 'Days with 20 mm of rain or more', unit: 'days' },
  { v: 'cdd', name: 'Longest dry spell', unit: 'days' },
];

export const projectionCode = (v: string, ssp: string, bound?: string) => `cckp:${v}.proj${ssp === MAIN ? '' : `.${ssp}`}${bound ? `.${bound}` : ''}`;

const metric = (code: string, name: string, unit: string, attrs?: Record<string, unknown>): MetricInput =>
  ({ code, name, unit, topic: 'environment', granularity: 'year', ...(attrs && { attrs }) });

/** "2030-07" → the year. */
const yearOf = (key: string) => Number(key.slice(0, 4));

export async function importCckp(ctx: Ctx) {
  const files = CCKP_VARS.flatMap(v => ['era5', 'cmip6-historical', 'cmip6'].map(f => join(DIR, `${f}-${v}.json`)));
  await importDataset(ctx, { source: 'wb-cckp', version: `era5 ${CCKP_ERA5}, cmip6 x0.25 1950-2100`, asOf: AS_OF, files, importerVersion: '2' }, async ds => {
    const rep = ds.report;
    const r = new Resolver(ctx);
    const batch = new SeriesBatch(ctx, ds);
    const subjectOf = (code: string, t: number) => r.resolveAny([['iso3', code], ['wb', code]], t);
    const unresolved = new Set<string>();

    const addAll = (id: number, byCode: Record<string, Record<string, number | null>>) => {
      for (const [code, years] of Object.entries(byCode)) {
        for (const [key, v] of Object.entries(years)) {
          const t = utc(yearOf(key));
          const subject = subjectOf(code, t);
          if (subject === undefined) {
            unresolved.add(code);
            continue;
          }
          rep.rows++;
          batch.add(id, 'entity', subject, { t, prec: Prec.year, v });
        }
      }
    };

    for (const m of CCKP_METRICS) {
      const observed = JSON.parse(readFileSync(join(DIR, `era5-${m.v}.json`), 'utf8')) as Record<string, Record<string, number | null>>;
      addAll(batch.metric(metric(`era5:${m.v}`, `${m.name}, observed (ERA5)`, m.unit)), observed);
      const historical = JSON.parse(readFileSync(join(DIR, `cmip6-historical-${m.v}.json`), 'utf8')) as Record<string, Record<string, Record<string, number | null>>>;
      addAll(batch.metric(metric(`cckp:${m.v}`, `${m.name} (CMIP6 historical run, model median)`, m.unit, { simulated: true })), historical.median);

      const projected = JSON.parse(readFileSync(join(DIR, `cmip6-${m.v}.json`), 'utf8')) as Record<string, Record<string, Record<string, Record<string, number | null>>>>;
      for (const ssp of SSPS) {
        const label = `CMIP6 model median, ${SSP_NAMES[ssp]}`;
        const sets = [
          { pct: 'median', id: batch.metric(metric(projectionCode(m.v, ssp), `${m.name} (${label})`, m.unit, { projection: true, scenario: ssp, base: `cckp:${m.v}` })) },
          ...BOUNDS.map(([pct, bound]) => ({
            pct,
            id: batch.metric(metric(projectionCode(m.v, ssp, bound), `${m.name} (CMIP6 ${pct}, ${SSP_NAMES[ssp]})`, m.unit, { projection: true, scenario: ssp, bound: pct, base: `cckp:${m.v}` })),
          })),
        ];
        for (const { pct, id } of sets) addAll(id, projected[pct]?.[ssp] ?? {});
      }
      batch.flush();
    }
    for (const code of unresolved) rep.reject('no polity for the code', code);
    return batch.finish();
  });
}

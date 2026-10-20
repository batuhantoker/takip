import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import type { MetricInput } from '@takip/db';
import { type Ctx, importDataset } from '../context';
import { csvRecords, num } from '../csv';
import { utc } from '../dates';
import { COW_NMC_CSV, COW_NMC_DIR } from '../fetch-military';
import { KEY_SCHEME, Resolver } from '../resolver';
import { SeriesBatch } from '../series';
import { DEFENCE_TOPIC } from './sipri';

/*
 * Correlates of War National Material Capabilities v7.0, 1816–2022 (fetch.ts `cow-nmc`; COW terms: cite the version and
 * Singer, Bremer & Stuckey 1972). Values are in thousands; -9 is missing, and zeros are COW's own (no steel, no army).
 */

const CSV = join(COW_NMC_DIR, COW_NMC_CSV);
const AS_OF = '2026-02-25';
const MISSING = ['-9'];

type NmcMetric = MetricInput & { column: string; scale: number; from?: number; to?: number };

/** Military spending is in pounds sterling to 1913 and US dollars from 1914 (codebook), so each currency is its own metric. */
export const NMC_METRICS: NmcMetric[] = [
  { column: 'milex', to: 1913, code: 'cow-nmc:milex_gbp', name: 'Military expenditure, current British pounds, to 1913 (COW NMC)', unit: '£', agg: 'sum', scale: 1000, topic: DEFENCE_TOPIC, granularity: 'year' },
  { column: 'milex', from: 1914, code: 'cow-nmc:milex_usd', name: 'Military expenditure, current US$, from 1914 (COW NMC)', unit: 'US$', agg: 'sum', scale: 1000, topic: DEFENCE_TOPIC, granularity: 'year' },
  { column: 'milper', code: 'cow-nmc:milper', name: 'Military personnel (COW NMC)', unit: 'people', agg: 'sum', scale: 1000, topic: DEFENCE_TOPIC, granularity: 'year' },
  { column: 'irst', code: 'cow-nmc:irst', name: 'Iron and steel production (COW NMC)', unit: 'tons', agg: 'sum', scale: 1000, topic: 'economy', granularity: 'year' },
  { column: 'pec', code: 'cow-nmc:pec', name: 'Primary energy consumption (COW NMC)', unit: 'tons of coal equivalent', agg: 'sum', scale: 1000, topic: 'Environment: Energy production & use', granularity: 'year' },
  { column: 'tpop', code: 'cow-nmc:tpop', name: 'Population (COW NMC)', unit: 'people', agg: 'sum', scale: 1000, topic: 'population', granularity: 'year' },
  { column: 'upop', code: 'cow-nmc:upop', name: 'Urban population, in cities over 100,000 (over 300,000 from 2002) (COW NMC)', unit: 'people', agg: 'sum', scale: 1000, topic: 'population', granularity: 'year' },
  // A share of the whole system's capabilities (all states sum to 1), stored as a percentage like the other shares.
  { column: 'cinc', code: 'cow-nmc:cinc', name: 'National capability (CINC), share of the world (COW NMC)', unit: '%', scale: 100, topic: DEFENCE_TOPIC, granularity: 'year' },
];

/**
 * COW codes North Vietnam and unified Viet Nam as one state (816), and the catalog has no North Vietnam polity:
 * those years stay unmapped rather than painting Viet Nam's shape over South Vietnam.
 */
const UNMAPPED: Record<string, { until: number; what: string }> = { '816': { until: 1976, what: 'North Vietnam, no polity in the catalog' } };

/** Why a state-year has no polity to go to, if it hasn't. */
export function unmappedState(ccode: string, year: number) {
  const u = UNMAPPED[ccode];
  return u && year < u.until ? u.what : undefined;
}

/** A country-year's values by metric, in base units (thousands × 1000, CINC × 100); null where COW codes -9. */
export function rowValues(row: Record<string, string>, year: number) {
  return NMC_METRICS.filter(m => (m.from === undefined || year >= m.from) && (m.to === undefined || year <= m.to)).map(m => {
    const v = num(row[m.column], MISSING);
    return { code: m.code, column: m.column, v: v === null ? null : v * m.scale };
  });
}

export async function importCowNmc(ctx: Ctx) {
  await importDataset(
    ctx,
    {
      source: 'cow-nmc',
      version: '7.0',
      asOf: AS_OF,
      files: [CSV],
      skipped: [
        { file: join(COW_NMC_DIR, 'NMC-v7-abridged.zip'), duplicateOf: CSV },
        { file: join(COW_NMC_DIR, 'NMCv7.zip'), reason: 'archive of the abridged and supplementary files and the codebook' },
      ],
      importerVersion: '1',
    },
    async ds => {
      const rep = ds.report;
      const r = new Resolver(ctx);
      const batch = new SeriesBatch(ctx, ds);
      const ids = new Map(NMC_METRICS.map(m => [m.code, batch.metric(m)]));
      const holders = new Map<string, Set<number>>();
      for await (const row of csvRecords(CSV)) {
        if (row.__header__) continue;
        const year = Number(row.year);
        if (!Number.isInteger(year)) {
          rep.reject('bad year', JSON.stringify(row));
          continue;
        }
        const unmapped = unmappedState(row.ccode, year);
        if (unmapped) {
          rep.miss(`cow:${row.ccode} ${row.stateabb} (${unmapped})`);
          continue;
        }
        const t = utc(year);
        // On 1 January, so a year of transition (1871, 1917, 1991) goes to the polity that held the code when it began.
        const subject = r.resolve('cow', row.ccode, t);
        if (subject === undefined) {
          rep.miss(`cow:${row.ccode} ${row.stateabb}`);
          continue;
        }
        rep.rows++;
        const state = `${row.ccode} ${row.stateabb}`;
        holders.set(state, (holders.get(state) ?? new Set<number>()).add(subject));
        for (const { code, column, v } of rowValues(row, year)) {
          if (v === null) rep.sentinel(`${column} -9 → no point`);
          else batch.add(ids.get(code)!, 'entity', subject, { t, prec: Prec.year, v });
        }
      }
      // Which polities each code went to, where that isn't simply one of today's countries.
      const keyOf = ctx.catalog.prepare(`SELECT value FROM core_entity_identifier WHERE entity_id = ? AND scheme_id = ?`).pluck();
      const keys = (ids: Set<number>) => [...ids].map(id => keyOf.get(id, r.schemeId(KEY_SCHEME)) as string);
      rep.extra.states = holders.size;
      rep.extra.historical = Object.fromEntries([...holders].map(([state, ids]): [string, string[]] => [state, keys(ids)]).filter(([, k]) => k.length > 1 || k[0].startsWith('hist:')));
      return batch.finish();
    },
  );
}

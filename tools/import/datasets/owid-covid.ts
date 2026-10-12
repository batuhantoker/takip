import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { type Ctx, importDataset, RAW_MORE } from '../context';
import { csvRecords, num, text } from '../csv';
import { isoDate } from '../dates';
import { Resolver } from '../resolver';
import { SeriesBatch } from '../series';
import { owidSubject } from './owid';

const DAY_MS = 86_400_000;
const VERSION = '2026-10-12';

/** OWID grapher CSVs written by `fetch.ts covid`: entity, code, day, value. */
const CHARTS = [
  { slug: 'weekly-covid-deaths-per-million-people', column: 'weekly_deaths_per_million', code: 'owid:covid_weekly_deaths_pm', name: 'Weekly confirmed COVID-19 deaths per million people', unit: 'deaths per million' },
  { slug: 'weekly-covid-cases-per-million-people', column: 'weekly_cases_per_million', code: 'owid:covid_weekly_cases_pm', name: 'Weekly confirmed COVID-19 cases per million people', unit: 'cases per million' },
  { slug: 'share-people-vaccinated-covid', column: 'people_vaccinated_per_hundred', code: 'owid:covid_vaccinated', name: 'Share of people with at least one COVID-19 vaccine dose', unit: '%' },
];
const path = (slug: string) => join(RAW_MORE, 'owid', `${slug}.csv`);

/** The Sunday ending a date's week; WHO reports in weeks ending Sunday. */
export const weekEnding = (t: number) => t + ((7 - new Date(t).getUTCDay()) % 7) * DAY_MS;

/**
 * Weekly, so the map can play the pandemic week by week. The CSVs repeat a rolling weekly sum every day,
 * so each week keeps its last row, dated to the week's Sunday. Stored as 'day' (the schema has no week).
 */
export async function importOwidCovid(ctx: Ctx) {
  const files = CHARTS.map(c => path(c.slug));
  await importDataset(ctx, { source: 'owid-covid', version: VERSION, asOf: VERSION, files, importerVersion: '1' }, async ds => {
    const r = new Resolver(ctx);
    const batch = new SeriesBatch(ctx, ds);
    for (const c of CHARTS) {
      const metric = batch.metric({ code: c.code, name: c.name, unit: c.unit, granularity: 'day', topic: 'health' });
      for await (const row of csvRecords(path(c.slug))) {
        ds.report.rows++;
        const name = text(row.entity);
        const day = isoDate(row.day);
        if (!name || day?.prec !== Prec.day) {
          ds.report.reject('no entity or day', JSON.stringify(row).slice(0, 120));
          continue;
        }
        const t = weekEnding(day.t);
        const subject = owidSubject(r, ds.sourceId, name, text(row.code), t);
        if (subject === undefined) {
          ds.report.miss(`${row.code || '-'} ${name}`);
          continue;
        }
        batch.add(metric, 'entity', subject, { t, v: num(row[c.column]), prec: Prec.day });
      }
    }
    return batch.finish();
  });
}

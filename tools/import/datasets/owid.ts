import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import type { MetricInput } from '@takip/db';
import { type Ctx, type DatasetSpec, importDataset, RAW, RAW_MORE } from '../context';
import { csvRecords, csvRows, num, text } from '../csv';
import { utc } from '../dates';
import { normName } from '../names';
import { Resolver } from '../resolver';
import { SeriesBatch } from '../series';

const f = (...p: string[]) => join(RAW, ...p);
const LE = (n: string) => f('life-expectancy', n);
const EDU = (n: string) => f('global education', n);
// A Kaggle repackaging, not OWID's own: the series match IHME GBD 2017, whose terms are non-commercial.
const MENTAL = f('global-trends-mental-disorder.zip Mental health Depression disorder Data.csv');

/** '1990' or '10000 BCE' (astronomical: 1 BCE is year 0). */
export function owidYear(s: string | undefined) {
  const m = s?.trim().match(/^(\d+)(\s*BCE)?$/);
  if (!m) return null;
  return m[2] ? 1 - Number(m[1]) : Number(m[1]);
}

/**
 * Codes resolve through the owid scheme (OWID_*) or ISO3; rows without a code are OWID aggregates and
 * become region groups, unless the name is already one (World, EU 27).
 */
export function owidSubject(r: Resolver, sourceId: number, name: string, code: string | null, t: number) {
  if (code) return r.resolveAny([['owid', code], ['iso3', code]], t) ?? r.byName(name, t);
  return r.byName(name, t) ?? r.region(`owid:${normName(name).replace(/ /g, '-')}`, name, sourceId);
}

type Column = Omit<MetricInput, 'granularity'> & { column: string };

async function owidLong(ctx: Ctx, spec: DatasetSpec, files: { path: string; columns: Column[]; codeColumn?: string; nameColumn?: string; yearColumn?: string }[]) {
  await importDataset(ctx, spec, async ds => {
    const r = new Resolver(ctx);
    const batch = new SeriesBatch(ctx, ds);
    for (const file of files) {
      const metrics = file.columns.map(c => ({ ...c, id: batch.metric({ ...c, granularity: 'year' }) }));
      for await (const row of csvRecords(file.path)) {
        if (row.__header__) continue;
        ds.report.rows++;
        const name = text(row[file.nameColumn ?? 'Entity']);
        const year = owidYear(row[file.yearColumn ?? 'Year']);
        if (!name || year === null) {
          ds.report.reject('no entity or year', JSON.stringify(row).slice(0, 120));
          continue;
        }
        const t = utc(year);
        const subject = owidSubject(r, ds.sourceId, name, text(row[file.codeColumn ?? 'Code']), t);
        if (subject === undefined) {
          ds.report.miss(`${row[file.codeColumn ?? 'Code'] || '-'} ${name}`);
          continue;
        }
        for (const m of metrics) batch.add(m.id, 'entity', subject, { t, v: num(row[m.column]), prec: Prec.year });
      }
    }
    return batch.finish();
  });
}

const VERSION = '2026-10-12';

export const importOwidConflict = (ctx: Ctx) =>
  owidLong(ctx, { source: 'owid-conflict', version: VERSION, asOf: VERSION, files: [f('countries-in-conflict-data.csv')], importerVersion: '1' }, [
    {
      path: f('countries-in-conflict-data.csv'),
      nameColumn: 'Country',
      codeColumn: 'Country Abbreviation',
      columns: [
        { column: 'Deaths in ongoing conflicts in a country (best estimate) - Conflict type: all', code: 'owid:conflict_deaths_all', name: 'Deaths in ongoing conflicts (best estimate)', unit: 'deaths', agg: 'sum', topic: 'conflict' },
      ],
    },
  ]);

const leColumns = (ages: number[], prefix: string): Column[] =>
  ages.map(a => ({
    column: a === 0 ? `${prefix} at birth - Sex: all - Age: 0` : `${prefix} - Sex: all - Age: ${a}`,
    code: `owid:le_${a}`,
    name: a === 0 ? 'Life expectancy at birth' : `Life expectancy at age ${a}`,
    unit: 'years',
    topic: 'health',
  }));

export const importOwidLifeExpectancy = (ctx: Ctx) =>
  owidLong(
    ctx,
    {
      source: 'owid-le',
      version: VERSION,
      asOf: VERSION,
      files: [LE('3- life-expectancy-at-different-ages.csv')],
      skipped: [{ file: LE('1- life-expectancy.csv'), duplicateOf: LE('3- life-expectancy-at-different-ages.csv') }],
      importerVersion: '1',
    },
    [{ path: LE('3- life-expectancy-at-different-ages.csv'), columns: leColumns([0, 10, 25, 45, 65, 80], 'Period life expectancy') }],
  );

export const importOwidLifeExpectancyHmd = (ctx: Ctx) =>
  owidLong(ctx, { source: 'owid-le-hmd', version: VERSION, asOf: VERSION, files: [LE('2- life-expectancy-hmd-unwpp.csv')], importerVersion: '1' }, [
    {
      path: LE('2- life-expectancy-hmd-unwpp.csv'),
      columns: [{ column: 'Life expectancy - Type: period - Sex: both - Age: 0', code: 'owid:le_0', name: 'Life expectancy at birth', unit: 'years', topic: 'health' }],
    },
  ]);

const EDU_FILES = {
  basic: EDU('1- share-of-the-world-population-with-at-least-basic-education.csv'),
  lays: EDU('2- learning-adjusted-years-of-school-lays.csv'),
  oos: EDU('3- number-of-out-of-school-children.csv'),
  gap: EDU('4- gender-gap-education-levels.csv'),
};

export const importOwidEducation = (ctx: Ctx) =>
  owidLong(ctx, { source: 'owid-edu', version: VERSION, asOf: VERSION, files: Object.values(EDU_FILES), importerVersion: '1' }, [
    {
      path: EDU_FILES.basic,
      columns: [
        { column: 'Share of population with no formal education, 1820-2020', code: 'owid:edu_no_formal', name: 'Share of population with no formal education', unit: '%', topic: 'education' },
        { column: 'Share of population with some formal education, 1820-2020', code: 'owid:edu_some_formal', name: 'Share of population with some formal education', unit: '%', topic: 'education' },
      ],
    },
    { path: EDU_FILES.lays, columns: [{ column: 'Learning-Adjusted Years of School', code: 'owid:lays', name: 'Learning-adjusted years of school', unit: 'years', topic: 'education' }] },
    {
      path: EDU_FILES.oos,
      columns: [
        { column: 'Out-of-school children, adolescents and youth of primary and secondary school age, male (number)', code: 'owid:oos_male', name: 'Out-of-school children and youth, male', unit: 'people', agg: 'sum', topic: 'education' },
        { column: 'Out-of-school children, adolescents and youth of primary and secondary school age, female (number)', code: 'owid:oos_female', name: 'Out-of-school children and youth, female', unit: 'people', agg: 'sum', topic: 'education' },
      ],
    },
    {
      path: EDU_FILES.gap,
      columns: [
        { column: 'Combined gross enrolment ratio for tertiary education, female', code: 'owid:ger_tertiary_f', name: 'Gross enrolment ratio, tertiary, female', unit: '%', topic: 'education' },
        { column: 'Combined gross enrolment ratio for tertiary education, male', code: 'owid:ger_tertiary_m', name: 'Gross enrolment ratio, tertiary, male', unit: '%', topic: 'education' },
        { column: 'Combined total net enrolment rate, secondary, male', code: 'owid:ner_secondary_m', name: 'Net enrolment rate, secondary, male', unit: '%', topic: 'education' },
        { column: 'Combined total net enrolment rate, secondary, female', code: 'owid:ner_secondary_f', name: 'Net enrolment rate, secondary, female', unit: '%', topic: 'education' },
        { column: 'Combined total net enrolment rate, primary, female', code: 'owid:ner_primary_f', name: 'Net enrolment rate, primary, female', unit: '%', topic: 'education' },
        { column: 'Combined total net enrolment rate, primary, male', code: 'owid:ner_primary_m', name: 'Net enrolment rate, primary, male', unit: '%', topic: 'education' },
      ],
    },
  ]);

/** No code column: resolved by name; "(WHO)" and "(SDG)" rows are region groups. */
export const importOwidWater = (ctx: Ctx) => {
  const path = f('share-of-the-population-using-safely-managed-drinking-water-sources.csv');
  return owidLong(ctx, { source: 'owid-water', version: VERSION, asOf: VERSION, files: [path], importerVersion: '1' }, [
    {
      path,
      nameColumn: 'Country',
      codeColumn: '__none__',
      columns: [{ column: 'Usage of safely managed drinking water services', code: 'owid:water_safely_managed', name: 'Share using safely managed drinking water', unit: '%', topic: 'health' }],
    },
  ]);
};

/** The four stacked tables of the mental-health file, by the header that starts each one. */
const MENTAL_BLOCKS: Column[][] = [
  [
    ['Schizophrenia (%)', 'schizophrenia'],
    ['Bipolar disorder (%)', 'bipolar'],
    ['Eating disorders (%)', 'eating'],
    ['Anxiety disorders (%)', 'anxiety'],
    ['Drug use disorders (%)', 'drug_use'],
    ['Depression (%)', 'depression'],
    ['Alcohol use disorders (%)', 'alcohol_use'],
  ].map(([column, key]) => ({ column, code: `owid:prev_${key}`, name: `Prevalence: ${column.replace(' (%)', '').toLowerCase()}`, unit: '%', topic: 'mental_health' })),
  [
    { column: 'Prevalence in males (%)', code: 'owid:prev_depression_male', name: 'Depression prevalence, males', unit: '%', topic: 'mental_health' },
    { column: 'Prevalence in females (%)', code: 'owid:prev_depression_female', name: 'Depression prevalence, females', unit: '%', topic: 'mental_health' },
    { column: 'Population', code: 'owid:population', name: 'Population', unit: 'people', agg: 'sum', topic: 'population' },
  ],
  [
    { column: 'Suicide rate (deaths per 100,000 individuals)', code: 'owid:suicide_rate', name: 'Suicide rate', unit: 'per 100,000', topic: 'mental_health' },
    { column: 'Depressive disorder rates (number suffering per 100,000)', code: 'owid:depressive_rate', name: 'Depressive disorder rate', unit: 'per 100,000', topic: 'mental_health' },
  ],
  [
    {
      column: 'Prevalence - Depressive disorders - Sex: Both - Age: All Ages (Number) (people suffering from depression)',
      code: 'owid:depressive_count',
      name: 'People with depressive disorders',
      unit: 'people',
      agg: 'sum',
      topic: 'mental_health',
    },
  ],
];

export async function importOwidMental(ctx: Ctx) {
  await importDataset(ctx, { source: 'owid-mental', version: VERSION, asOf: VERSION, files: [MENTAL], importerVersion: '1' }, async ds => {
    const r = new Resolver(ctx);
    const batch = new SeriesBatch(ctx, ds);
    let block = -1;
    let header: string[] = [];
    let metrics: { index: number; id: number }[] = [];
    for await (const row of csvRows(MENTAL)) {
      if (row[1] === 'Entity') {
        block++;
        header = row;
        // Population repeats in block 3; block 2's copy is the one kept (dataset-import-map.md §3).
        metrics = MENTAL_BLOCKS[block].map(c => ({ index: header.indexOf(c.column), id: batch.metric({ ...c, granularity: 'year' }) }));
        if (metrics.some(m => m.index < 0)) throw new Error(`mental health block ${block}: header changed: ${header.join('|')}`);
        continue;
      }
      ds.report.rows++;
      const year = owidYear(row[3]);
      const name = text(row[1]);
      if (!name || year === null) {
        ds.report.reject('no entity or year', row.join(',').slice(0, 120));
        continue;
      }
      if (row[3].includes('BCE')) ds.report.sentinel('BCE year → negative astronomical year');
      const t = utc(year);
      const subject = owidSubject(r, ds.sourceId, name, text(row[2]), t);
      if (subject === undefined) {
        ds.report.miss(`${row[2] || '-'} ${name}`);
        continue;
      }
      for (const m of metrics) batch.add(m.id, 'entity', subject, { t, v: num(row[m.index]), prec: Prec.year });
    }
    if (block !== MENTAL_BLOCKS.length - 1) throw new Error(`mental health: expected ${MENTAL_BLOCKS.length} blocks, found ${block + 1}`);
    return batch.finish();
  });
}

/**
 * Undated, so every point sits at the dataset's as_of with unknown precision.
 * Licence and methodology are unverified (dataset-import-map.md §3); shown anyway while terms are pending.
 */
export async function importIq(ctx: Ctx) {
  const path = f('International_IQ.csv');
  const AS_OF = '2023-01-01';
  await importDataset(ctx, { source: 'iq-2023', version: '2023', asOf: AS_OF, files: [path], importerVersion: '1' }, async ds => {
    const r = new Resolver(ctx);
    const batch = new SeriesBatch(ctx, ds);
    const avg = batch.metric({ code: 'iq:average', name: 'Average IQ', unit: 'IQ points', granularity: 'irregular', topic: 'education' });
    const n = batch.metric({ code: 'iq:participants', name: 'IQ test participants', unit: 'people', granularity: 'irregular', agg: 'sum', topic: 'education' });
    const t = Date.parse(`${AS_OF}T00:00:00Z`);
    for await (const row of csvRecords(path)) {
      ds.report.rows++;
      const name = text(row.Country);
      if (!name) {
        ds.report.reject('no country', JSON.stringify(row));
        continue;
      }
      const subject = r.byName(name, t);
      if (subject === undefined) {
        ds.report.miss(name);
        continue;
      }
      batch.add(avg, 'entity', subject, { t, v: num(row['Average IQ']), prec: Prec.unknown }, { rank: num(row.Ranking) });
      batch.add(n, 'entity', subject, { t, v: num(row.Participants), prec: Prec.unknown });
    }
    return batch.finish();
  });
}

const LONG = (slug: string) => join(RAW_MORE, 'owid', `${slug}.csv`);

/** Grapher CSVs (fetch.ts owid) that colour countries well before WDI's 1960, from 1 CE for Maddison GDP. */
const LONG_RUN: { slug: string; column: Column }[] = [
  { slug: 'gdp-per-capita-maddison-project-database', column: { column: 'gdp_per_capita', code: 'owid:gdp_pc_maddison', name: 'GDP per person, long run (Maddison)', unit: 'international-$ in 2011 prices', agg: 'mean', topic: 'economy' } },
  { slug: 'electoral-democracy-index', column: { column: 'electdem_vdem__estimate_best', code: 'owid:electdem_vdem', name: 'Electoral democracy index (V-Dem)', unit: 'index 0–1', agg: 'mean', topic: 'politics' } },
  { slug: 'human-rights-index-vdem', column: { column: 'civ_libs_vdem__estimate_best', code: 'owid:civlibs_vdem', name: 'Human rights index (V-Dem)', unit: 'index 0–1', agg: 'mean', topic: 'politics' } },
  { slug: 'child-mortality', column: { column: 'child_mortality_rate', code: 'owid:child_mortality', name: 'Child mortality (deaths before age 5)', unit: 'deaths per 100 live births', agg: 'mean', topic: 'health' } },
  { slug: 'cross-country-literacy-rates', column: { column: 'literacy_rate', code: 'owid:literacy', name: 'Literacy rate, long run', unit: '%', agg: 'mean', topic: 'education' } },
  { slug: 'mean-years-of-schooling-long-run', column: { column: 'mf_youth_and_adults__15_64_years__average_years_of_education', code: 'owid:schooling_years', name: 'Average years of schooling (ages 15–64)', unit: 'years', agg: 'mean', topic: 'education' } },
  { slug: 'co-emissions-per-capita', column: { column: 'emissions_total_per_capita', code: 'owid:co2_pc', name: 'CO₂ emissions per person', unit: 'tonnes per person', agg: 'mean', topic: 'environment' } },
  { slug: 'children-born-per-woman', column: { column: 'fertility_rate_hist', code: 'owid:fertility_hist', name: 'Fertility rate, long run', unit: 'live births per woman', agg: 'mean', topic: 'people' } },
  // HYDE to 1800, Gapminder to 1949, UN WPP 2024 after: under the mental-health file's code, as that metric's fuller source.
  { slug: 'population', column: { column: 'population_historical', code: 'owid:population', name: 'Population', unit: 'people', agg: 'sum', topic: 'population' } },
];

export const importOwidLongRun = (ctx: Ctx) =>
  owidLong(
    ctx,
    { source: 'owid-longrun', version: VERSION, asOf: VERSION, files: LONG_RUN.map(l => LONG(l.slug)), importerVersion: '1' },
    LONG_RUN.map(l => ({ path: LONG(l.slug), nameColumn: 'entity', codeColumn: 'code', yearColumn: 'year', columns: [l.column] })),
  );

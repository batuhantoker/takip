import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import type { MetricInput } from '@takip/db';
import { type Ctx, importDataset, RAW_MORE } from '../context';
import { csvRecords, num, readCsv } from '../csv';
import { utc } from '../dates';
import { Resolver } from '../resolver';
import { SeriesBatch } from '../series';

/* UN World Population Prospects 2024 (CC BY 3.0 IGO): fetch.ts `wpp`. */

const DIR = join(RAW_MORE, 'wpp');
const INDICATORS = join(DIR, 'WPP2024_Demographic_Indicators_Medium.csv');
/** January 2026 interim update: Togo re-estimated, same columns. */
const UPDATE = join(DIR, 'WPP2024_Demographic_Indicators_Medium_Update.csv');
const TOGO = '768';
/** Projections only (2024–2100), same columns; each variant's rows come country by country. */
const VARIANTS_FILE = join(DIR, 'WPP2024_Demographic_Indicators_OtherVariants.csv.gz');
/** Population by five-year age group (thousands), medium variant 1950–2100, and Togo's January 2026 rows. */
const AGES = join(DIR, 'WPP2024_PopulationByAge5GroupSex_Medium.csv.gz');
const AGES_UPDATE = join(DIR, 'WPP2024_PopulationByAge5GroupSex_Medium_Update.csv');
const LOCATION_NOTES = join(DIR, 'WPP2024_Locations_notes.csv');
const AS_OF = '2024-07-11';

/** The revision's last estimate year; 2024–2100 are the medium-variant projections. */
export const LAST_ESTIMATE = 2023;
/** 2101 rows carry only 1 January population. */
export const LAST_PROJECTION = 2100;

type WppMetric = MetricInput & { column: string; scale?: number };

/** What WPP adds beside WDI and OWID: median age, migration and the sex and age detail nobody else has, the rest as UN's own series. */
export const WPP_METRICS: WppMetric[] = [
  { column: 'TPopulation1July', code: 'wpp:TPopulation1July', name: 'Population, 1 July (UN WPP)', unit: 'people', agg: 'sum', scale: 1000, topic: 'population', granularity: 'year' },
  { column: 'PopDensity', code: 'wpp:PopDensity', name: 'Population density (UN WPP)', unit: 'people per km²', topic: 'population', granularity: 'year' },
  { column: 'MedianAgePop', code: 'wpp:MedianAgePop', name: 'Median age', unit: 'years', topic: 'population', granularity: 'year' },
  { column: 'TFR', code: 'wpp:TFR', name: 'Fertility rate (UN WPP)', unit: 'live births per woman', topic: 'population', granularity: 'year' },
  { column: 'CBR', code: 'wpp:CBR', name: 'Crude birth rate', unit: 'births per 1,000 people', topic: 'population', granularity: 'year' },
  { column: 'CDR', code: 'wpp:CDR', name: 'Crude death rate', unit: 'deaths per 1,000 people', topic: 'health', granularity: 'year' },
  { column: 'LEx', code: 'wpp:LEx', name: 'Life expectancy at birth (UN WPP)', unit: 'years', topic: 'health', granularity: 'year' },
  { column: 'IMR', code: 'wpp:IMR', name: 'Infant mortality rate (UN WPP)', unit: 'infant deaths per 1,000 live births', topic: 'health', granularity: 'year' },
  { column: 'Q5', code: 'wpp:Q5', name: 'Under-five mortality rate (UN WPP)', unit: 'deaths under age 5 per 1,000 live births', topic: 'health', granularity: 'year' },
  { column: 'CNMR', code: 'wpp:CNMR', name: 'Net migration rate', unit: 'per 1,000 people', topic: 'population', granularity: 'year' },
  { column: 'PopGrowthRate', code: 'wpp:PopGrowthRate', name: 'Population growth rate (UN WPP)', unit: '%', topic: 'population', granularity: 'year' },
  { column: 'NatChangeRT', code: 'wpp:NatChangeRT', name: 'Rate of natural change (births minus deaths)', unit: 'per 1,000 people', topic: 'population', granularity: 'year' },
  { column: 'Births', code: 'wpp:Births', name: 'Births (UN WPP)', unit: 'births', agg: 'sum', scale: 1000, topic: 'population', granularity: 'year' },
  { column: 'Deaths', code: 'wpp:Deaths', name: 'Deaths (UN WPP)', unit: 'deaths', agg: 'sum', scale: 1000, topic: 'health', granularity: 'year' },
  { column: 'NetMigrations', code: 'wpp:NetMigrations', name: 'Net migrants (UN WPP)', unit: 'people', agg: 'sum', scale: 1000, topic: 'population', granularity: 'year' },
  { column: 'MAC', code: 'wpp:MAC', name: 'Mean age of mothers at childbirth', unit: 'years', topic: 'population', granularity: 'year' },
  { column: 'NRR', code: 'wpp:NRR', name: 'Net reproduction rate', unit: 'surviving daughters per woman', topic: 'population', granularity: 'year' },
  { column: 'SRB', code: 'wpp:SRB', name: 'Sex ratio at birth', unit: 'boys per 100 girls born', topic: 'population', granularity: 'year' },
  { column: 'PopSexRatio', code: 'wpp:PopSexRatio', name: 'Sex ratio of the population', unit: 'men per 100 women', topic: 'population', granularity: 'year' },
  { column: 'LExMale', code: 'wpp:LExMale', name: 'Life expectancy at birth, men (UN WPP)', unit: 'years', topic: 'health', granularity: 'year' },
  { column: 'LExFemale', code: 'wpp:LExFemale', name: 'Life expectancy at birth, women (UN WPP)', unit: 'years', topic: 'health', granularity: 'year' },
  { column: 'LE65', code: 'wpp:LE65', name: 'Life expectancy at 65 (years still to live)', unit: 'years', topic: 'health', granularity: 'year' },
];

type AgeBands = { total: number; under15: number; working: number; over65: number };

/** Age structure as WPP's own tables give it (F06, F07), summed from its age groups; working age is 20–64, WPP's usual definition. */
export const AGE_METRICS: (MetricInput & { of: (b: AgeBands) => number })[] = [
  { code: 'wpp:Share65', name: 'People aged 65 and over, share (UN WPP)', unit: '%', topic: 'population', granularity: 'year', of: b => (100 * b.over65) / b.total },
  { code: 'wpp:Share0_14', name: 'Children under 15, share (UN WPP)', unit: '%', topic: 'population', granularity: 'year', of: b => (100 * b.under15) / b.total },
  { code: 'wpp:OldAgeDep', name: 'Old-age dependency ratio (65+ per 100 aged 20–64)', unit: 'per 100 aged 20–64', topic: 'population', granularity: 'year', of: b => (100 * b.over65) / b.working },
];

/** Sums one location-year's age groups into the bands AGE_METRICS divide. */
export function addAgeGroup(b: AgeBands, start: number, total: number) {
  b.total += total;
  if (start < 15) b.under15 += total;
  if (start >= 20 && start < 65) b.working += total;
  if (start >= 65) b.over65 += total;
}

/**
 * The variants History offers as scenarios (src/lib/history/projection.ts names them), and the 95% prediction
 * interval around the medium variant as its range. Keyed by VarID: the file spells some names two ways.
 */
export const VARIANTS: Record<string, { suffix: string; label: string }> = {
  3: { suffix: '.high', label: 'high variant' },
  4: { suffix: '.low', label: 'low variant' },
  5: { suffix: '.constant-fertility', label: 'constant-fertility variant' },
  7: { suffix: '.zero-migration', label: 'zero-migration variant' },
  207: { suffix: '.lo', label: 'lower bound of the 95% prediction interval' },
  206: { suffix: '.hi', label: 'upper bound of the 95% prediction interval' },
};

/** Each metric's projections, under codes of their own so the API never picks them as the default source. */
export const projectionOf = (m: WppMetric, variant = { suffix: '', label: 'medium variant' }): WppMetric => ({
  ...m,
  code: `${m.code}.proj${variant.suffix}`,
  name: `${m.name.replace(/ \(UN WPP\)$/, '')} (UN projection, ${variant.label})`,
  attrs: { projection: true, variant: variant.label, base: m.code },
});

const COUNTRY = '4';
const WORLD = '1';

export async function importWpp(ctx: Ctx) {
  await importDataset(ctx, { source: 'wpp-2024', version: AS_OF, asOf: AS_OF, files: [INDICATORS, UPDATE, LOCATION_NOTES, VARIANTS_FILE, AGES, AGES_UPDATE], importerVersion: '4' }, async ds => {
    const rep = ds.report;
    const r = new Resolver(ctx);
    const batch = new SeriesBatch(ctx, ds);
    const metrics = WPP_METRICS.map(m => ({
      ...m,
      id: batch.metric(m),
      projected: batch.metric(projectionOf(m)),
      variants: Object.fromEntries(Object.entries(VARIANTS).map(([varId, v]) => [varId, batch.metric(projectionOf(m, v))])),
    }));
    const togo = new Map((await readCsv(UPDATE)).map(row => [`${row.LocID}|${row.Time}`, row]));
    const notes = new Map((await readCsv(LOCATION_NOTES)).map(n => [n.Notes, n.Text]));
    const footnoted = new Map<number, string>();

    for await (const raw of csvRecords(INDICATORS)) {
      if (raw.__header__) continue;
      const year = Number(raw.Time);
      if (!Number.isInteger(year) || year > LAST_PROJECTION) continue;
      if (raw.LocTypeID !== COUNTRY && raw.LocTypeID !== WORLD) continue;
      rep.rows++;
      const row = togo.get(`${raw.LocID}|${raw.Time}`) ?? raw;
      const t = utc(year);
      const subject = row.LocTypeID === WORLD ? r.key('region:world') : r.resolve('iso3', row.ISO3_code, t);
      if (subject === undefined) {
        rep.reject('no polity for the ISO3 code', row.ISO3_code);
        continue;
      }
      if (row.Notes && notes.has(row.Notes)) footnoted.set(subject, notes.get(row.Notes)!);
      const projected = year > LAST_ESTIMATE;
      for (const m of metrics) {
        const v = num(row[m.column]);
        batch.add(projected ? m.projected : m.id, 'entity', subject, { t, prec: Prec.year, v: v === null ? null : v * (m.scale ?? 1) });
      }
    }
    batch.flush();

    // A series is written whole, so each (variant, country) run is flushed when the next begins; a run seen twice would overwrite.
    const runs = new Set<string>();
    let run = '';
    let variantRows = 0;
    for await (const row of csvRecords(VARIANTS_FILE)) {
      if (row.__header__ || !VARIANTS[row.VarID]) continue;
      // The January 2026 update revised Togo's medium variant only, which its other variants no longer match.
      if (row.LocID === TOGO) continue;
      if (row.LocTypeID !== COUNTRY && row.LocTypeID !== WORLD) continue;
      const year = Number(row.Time);
      if (!Number.isInteger(year) || year <= LAST_ESTIMATE || year > LAST_PROJECTION) continue;
      const key = `${row.VarID}|${row.LocID}`;
      if (key !== run) {
        if (runs.has(key)) throw new Error(`wpp: ${key} rows are not together`);
        runs.add(key);
        run = key;
        batch.flush();
      }
      const t = utc(year);
      const subject = row.LocTypeID === WORLD ? r.key('region:world') : r.resolve('iso3', row.ISO3_code, t);
      if (subject === undefined) continue;
      variantRows++;
      for (const m of metrics) {
        const v = num(row[m.column]);
        batch.add(m.variants[row.VarID], 'entity', subject, { t, prec: Prec.year, v: v === null ? null : v * (m.scale ?? 1) });
      }
    }
    rep.extra.variants = { rows: variantRows, runs: runs.size };

    // Age structure: one location-year's groups come together; Togo's come from the update.
    const bands = new Map<string, AgeBands & { iso3: string; world: boolean; year: number }>();
    const addAges = async (file: string, togoOnly: boolean) => {
      for await (const row of csvRecords(file)) {
        if (row.__header__ || (row.LocTypeID !== COUNTRY && row.LocTypeID !== WORLD)) continue;
        if ((row.LocID === TOGO) !== togoOnly) continue;
        const year = Number(row.Time);
        const total = num(row.PopTotal);
        if (!Number.isInteger(year) || year > LAST_PROJECTION || total === null) continue;
        const key = `${row.LocID}|${year}`;
        let b = bands.get(key);
        if (!b) bands.set(key, (b = { total: 0, under15: 0, working: 0, over65: 0, iso3: row.ISO3_code, world: row.LocTypeID === WORLD, year }));
        addAgeGroup(b, Number(row.AgeGrpStart), total);
      }
    };
    await addAges(AGES, false);
    await addAges(AGES_UPDATE, true);
    const ageMetrics = AGE_METRICS.map(m => ({ ...m, id: batch.metric(m), projected: batch.metric(projectionOf({ ...m, column: '' })) }));
    for (const b of bands.values()) {
      const t = utc(b.year);
      const subject = b.world ? r.key('region:world') : r.resolve('iso3', b.iso3, t);
      if (subject === undefined || !b.total) continue;
      for (const m of ageMetrics) batch.add(b.year > LAST_ESTIMATE ? m.projected : m.id, 'entity', subject, { t, prec: Prec.year, v: m.of(b) });
    }
    rep.extra.ages = { locationYears: bands.size };
    const publish = batch.finish();

    // Each footnote says what a country's figures cover ("excluding Kosovo"), so it goes on every series of that country.
    const series = ctx.history.prepare(`SELECT series_id FROM ts_series WHERE source_id = ? AND subject_type = 'entity' AND subject_id = ?`).pluck();
    let links = 0;
    ctx.history.transaction(() => {
      for (const [subject, text] of footnoted) {
        const note = ctx.series.note(text);
        for (const id of series.all(ds.sourceId, subject) as number[]) {
          ctx.series.linkNote(id, null, note);
          links++;
        }
      }
    })();
    rep.extra.notes = { countries: footnoted.size, links, togo_rows: togo.size };
    return publish;
  });
}

import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { PointFlag } from '@takip/db';
import { batched, type Ctx, type Dataset, importDataset, RAW_MORE } from '../context';
import { csvRecords, num, readCsv } from '../csv';
import { utc } from '../dates';
import { normName } from '../names';
import { Resolver } from '../resolver';
import { SeriesBatch } from '../series';

/** fetch.ts `wdi`: the World Bank's bulk CSV. */
const DIR = join(RAW_MORE, 'wdi');
const f = (name: string) => join(DIR, name);
// The zip's last-modified day; the files state no release date.
const AS_OF = '2026-10-08';
const AT = Date.parse(AS_OF);
const POINTS_PER_FLUSH = 500_000;
const LINKS_PER_TX = 10_000;

/** Region → its all-income aggregate and, where WB splits one off, the aggregate without high-income members. */
const REGION: Record<string, [all: string, developing?: string]> = {
  'East Asia & Pacific': ['EAS', 'EAP'],
  'Europe & Central Asia': ['ECS', 'ECA'],
  'Latin America & Caribbean': ['LCN', 'LAC'],
  'Middle East & North Africa': ['MEA', 'MNA'],
  'Sub-Saharan Africa': ['SSF', 'SSA'],
  'South Asia': ['SAS'],
  'North America': ['NAC'],
};
/** Income group → every income aggregate it falls in. */
const INCOME: Record<string, string[]> = {
  'High income': ['HIC'],
  'Upper middle income': ['UMC', 'MIC', 'LMY'],
  'Lower middle income': ['LMC', 'MIC', 'LMY'],
  'Low income': ['LIC', 'LMY'],
};
/** Lending category → WB's aggregate code, and its name for a release without the aggregate. */
const LENDING: Record<string, [code: string, name: string]> = {
  IBRD: ['IBD', 'IBRD only'],
  IDA: ['IDX', 'IDA only'],
  Blend: ['IDB', 'IDA blend'],
};
const OTHER: Record<string, string> = { HIPC: 'HPC', 'Euro area': 'EMU' };
/** WDICountry.csv columns that become region membership instead of attrs. */
const GROUP_COLS = new Set(['Country Code', 'Region', 'Income Group', 'Lending category', 'Other groups']);

/** "Unit of measure" → unit_of_measure, the column names x_wdi_series_meta has always had. */
const snake = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const code = (s: string | undefined) => (s ?? '').trim().toUpperCase();
/** csv.text() strips "[n]" as wiki citations, but WDI text has real ones ("Balance of Payments Manual [2009]"). */
const raw = (s: string | undefined) => s?.trim() || null;

const UNITISH =
  /%|\$|\bLCU\b|\bPPP\b|=|\bper\b|^(years|days|hours|number|scale)\b|\b(kg|km|kt|Mt|MJ|mm|TEU|kWh|micrograms|kilocalories|hectares|metric tons|cubic meters|sq\. km|CO2e)\b|-km\b/;

/**
 * The unit in an indicator name's last unit-like parenthetical, after qualifiers like "BoP, ".
 * "(% of labor force) (modeled ILO estimate)" puts it in the one before last.
 */
export function wdiUnit(name: string): string | null {
  for (const m of [...name.matchAll(/\(([^()]*)\)/g)].reverse()) {
    const parts = m[1].split(', ');
    const i = parts.findIndex(p => UNITISH.test(p.trim()));
    if (i >= 0) return parts.slice(i).join(', ').trim();
  }
  return null;
}

/** CC BY in any spelling ("CC BY-4.0", "CC BY 3.0 IGO"); the old release said "Open". */
export const isOpenLicence = (s: string | undefined) => /^(open|cc[ -]by\b)/i.test(s?.trim() ?? '');

/** 'YR2012' / 'yr2012' → 2012. */
export function noteYear(s: string | undefined) {
  const m = s?.trim().match(/^yr(\d{4})$/i);
  return m ? Number(m[1]) : null;
}

/** Metric and subject ids packed into one map key. */
const seriesKey = (metricId: number, subjectId: number) => metricId * 2 ** 32 + subjectId;

export async function importWdi(ctx: Ctx) {
  await importDataset(
    ctx,
    {
      source: 'wdi',
      version: AS_OF,
      asOf: AS_OF,
      files: ['WDISeries.csv', 'WDICountry.csv', 'WDICSV.csv', 'WDIfootnote.csv', 'WDIcountry-series.csv', 'WDIseries-time.csv'].map(f),
      skipped: [{ file: f('WDI_CSV.zip'), duplicateOf: f('WDICSV.csv') }],
      importerVersion: '3',
    },
    async ds => {
      const batch = new SeriesBatch(ctx, ds);
      const metrics = loadMetrics(ctx, ds, batch, await readCsv(f('WDISeries.csv')));
      const subjects = loadCountries(ctx, ds, await readCsv(f('WDICountry.csv')));
      await loadPoints(ds, batch, metrics, subjects);
      const publish = batch.finish();
      await loadNotes(ctx, ds, metrics, subjects);
      return publish;
    },
  );
}

/** WDISeries.csv → ts_metric, with the long-form metadata in x_wdi_series_meta. */
function loadMetrics(ctx: Ctx, ds: Dataset, batch: SeriesBatch, series: Record<string, string>[]) {
  const cols = Object.keys(series[0]).filter(c => !['Series Code', 'Topic', 'Indicator Name'].includes(c));
  // Rebuilt each import: a release can add or rename metadata columns.
  ctx.history.exec(`DROP TABLE IF EXISTS x_wdi_series_meta`);
  ctx.history.exec(`CREATE TABLE x_wdi_series_meta (
    metric_id INTEGER PRIMARY KEY REFERENCES ts_metric, ${cols.map(c => `${snake(c)} TEXT`).join(', ')}
  ) STRICT`);
  const meta = ctx.history.prepare(`INSERT OR REPLACE INTO x_wdi_series_meta (metric_id, ${cols.map(snake).join(', ')}) VALUES (?${', ?'.repeat(cols.length)})`);
  const metrics = new Map<string, number>();
  const restricted: string[] = [];
  ctx.history.transaction(() => {
    for (const s of series) {
      const sc = code(s['Series Code']);
      const aggregation = raw(s['Aggregation method']);
      // Imported whatever the licence (SIPRI's six series have their own terms), and listed in the report.
      if (!isOpenLicence(s['License Type'])) restricted.push(sc);
      const id = batch.metric({
        code: `wdi:${sc}`,
        name: s['Indicator Name'].trim(),
        unit: wdiUnit(s['Indicator Name']) ?? (UNITISH.test(s['Unit of measure']) ? s['Unit of measure'].trim() : null),
        granularity: 'year',
        agg: aggregation === 'Sum' || aggregation === 'Gap-filled total' ? 'sum' : 'mean',
        topic: raw(s.Topic),
        attrs: {
          definition: raw(s['Long definition']),
          short_definition: raw(s['Short definition']),
          source: raw(s.Source),
          licence: raw(s['License Type']),
          aggregation,
          base_period: raw(s['Base Period']),
        },
      });
      metrics.set(sc, id);
      meta.run(id, ...cols.map(c => raw(s[c])));
    }
  })();
  ds.report.extra.restricted_series = restricted;
  return metrics;
}

/** WDICountry.csv → polities and aggregate region groups, their attrs.wdi, and region membership. */
function loadCountries(ctx: Ctx, ds: Dataset, countries: Record<string, string>[]) {
  const r = new Resolver(ctx);
  const rep = ds.report;
  const src = ds.sourceId;
  const subjects = new Map<string, number>();
  const setAttrs = ctx.catalog.prepare(`UPDATE core_entity SET attrs = json_set(attrs, '$.wdi', json(?)), updated_at = ? WHERE entity_id = ?`);
  ctx.catalog.transaction(() => {
    for (const c of countries) {
      const cc = code(c['Country Code']);
      // Aggregates have no Region; WLD and EUU are seeded under 'wb'.
      const id = c.Region
        ? r.resolveAny([['wb', cc], ['iso3', cc]], AT)
        : (r.resolve('wb', cc, AT) ?? r.region(`wb:${cc}`, c['Short Name'].trim(), src));
      if (id === undefined) {
        rep.miss(`wb:${cc} ${c['Short Name']}`);
        continue;
      }
      r.remember('wb', cc, id, src);
      subjects.set(cc, id);
      const attrs = Object.entries(c).filter(([k, v]) => !GROUP_COLS.has(k) && raw(v)).map(([k, v]) => [snake(k), raw(v)]);
      setAttrs.run(JSON.stringify(Object.fromEntries(attrs)), Date.now(), id);
    }
  })();

  const wbGroup = (wb: string, name?: string) => {
    const id = subjects.get(wb) ?? r.resolve('wb', wb, AT) ?? (name ? r.region(`wb:${wb}`, name, src) : undefined);
    if (id === undefined) rep.miss(`wb group ${wb}`);
    else if (name) r.remember('wb', wb, id, src);
    return id;
  };
  const slugGroup = (name: string) => r.region(`wb:${normName(name).replace(/ /g, '-')}`, name, src);
  const members: [group: number, member: number][] = [];
  ctx.catalog.transaction(() => {
    for (const c of countries) {
      const id = subjects.get(code(c['Country Code']));
      if (!c.Region || id === undefined) continue;
      const groups = [wbGroup('WLD')];
      const region = REGION[c.Region];
      if (!region) groups.push(slugGroup(c.Region));
      else {
        groups.push(wbGroup(region[0]));
        if (region[1] && c['Income Group'] !== 'High income') groups.push(wbGroup(region[1]));
      }
      const income = c['Income Group'];
      const lending = c['Lending category'];
      const other = c['Other groups'];
      if (income) groups.push(...(INCOME[income]?.map(g => wbGroup(g)) ?? [slugGroup(income)]));
      if (lending) groups.push(LENDING[lending] ? wbGroup(...LENDING[lending]) : slugGroup(lending));
      if (other) groups.push(OTHER[other] ? wbGroup(OTHER[other]) : slugGroup(other));
      for (const g of groups) if (g !== undefined) members.push([g, id]);
    }
  })();
  // WB recomputes every year's aggregate with the current classification, so membership is open-ended.
  ctx.catalog.prepare(`DELETE FROM core_region_member WHERE source_id = ?`).run(src);
  const member = ctx.catalog.prepare(`INSERT INTO core_region_member (group_id, member_id, source_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`);
  batched(ctx.catalog, members, ([g, m]) => member.run(g, m, src));
  rep.extra.region_members = members.length;
  return subjects;
}

/** WDICSV.csv is wide: a row is one country's indicator, with a column per year. */
async function loadPoints(ds: Dataset, batch: SeriesBatch, metrics: Map<string, number>, subjects: Map<string, number>) {
  const rep = ds.report;
  let unflushed = 0;
  for await (const row of csvRecords(f('WDICSV.csv'))) {
    if (row.__header__) continue;
    rep.rows++;
    const metricId = metrics.get(code(row['Indicator Code']));
    const subjectId = subjects.get(code(row['Country Code']));
    if (metricId === undefined) {
      rep.reject('unknown Indicator Code', row['Indicator Code']);
      continue;
    }
    if (subjectId === undefined) {
      rep.reject('unresolved Country Code', row['Country Code']);
      continue;
    }
    for (const [col, v] of Object.entries(row)) {
      if (!/^\d{4}$/.test(col)) continue;
      batch.add(metricId, 'entity', subjectId, { t: utc(Number(col)), v: num(v), prec: Prec.year });
      unflushed++;
    }
    if (unflushed >= POINTS_PER_FLUSH) {
      batch.flush();
      unflushed = 0;
    }
  }
}

/** The three notes files → ts_note + ts_point_note, then the footnoted flag on every noted point. */
async function loadNotes(ctx: Ctx, ds: Dataset, metrics: Map<string, number>, subjects: Map<string, number>) {
  const rep = ds.report;
  const src = ds.sourceId;
  const seriesIds = new Map<number, number>();
  const byMetric = new Map<number, number[]>();
  const rows = ctx.history.prepare(`SELECT series_id AS id, metric_id AS m, subject_id AS e FROM ts_series WHERE source_id = ? AND subject_type = 'entity'`);
  for (const s of rows.iterate(src) as Iterable<{ id: number; m: number; e: number }>) {
    seriesIds.set(seriesKey(s.m, s.e), s.id);
    const list = byMetric.get(s.m) ?? [];
    list.push(s.id);
    byMetric.set(s.m, list);
  }
  ctx.history.prepare(`DELETE FROM ts_point_note WHERE series_id IN (SELECT series_id FROM ts_series WHERE source_id = ?)`).run(src);

  const noteIds = new Map<string, number>();
  const noteId = (desc: string) => {
    let id = noteIds.get(desc);
    if (id === undefined) noteIds.set(desc, (id = ctx.series.note(desc)));
    return id;
  };
  const counts: Record<string, { links: number; no_series: number }> = {};
  /** Links each row's description to the series `target` picks; a null target is a malformed row. */
  const link = async (file: string, target: (n: Record<string, string>) => { series: number[] | undefined; t: number | null } | null) => {
    const c = (counts[file] = { links: 0, no_series: 0 });
    let chunk: { series: number[]; t: number | null; desc: string }[] = [];
    let links = 0;
    const write = () => {
      ctx.history.transaction(() => {
        for (const n of chunk) {
          const id = noteId(n.desc);
          for (const s of n.series) ctx.series.linkNote(s, n.t, id);
        }
      })();
      chunk = [];
      links = 0;
    };
    for await (const n of csvRecords(f(file))) {
      if (n.__header__) continue;
      const to = target(n);
      const desc = raw(n.DESCRIPTION);
      if (!to || !desc) rep.reject(`${file}: bad row`, JSON.stringify(n));
      else if (!to.series?.length) c.no_series++;
      else {
        chunk.push({ series: to.series, t: to.t, desc });
        c.links += to.series.length;
        links += to.series.length;
        if (links >= LINKS_PER_TX) write();
      }
    }
    write();
  };
  const one = (country: string, series: string) => {
    const m = metrics.get(code(series));
    const e = subjects.get(code(country));
    const id = m === undefined || e === undefined ? undefined : seriesIds.get(seriesKey(m, e));
    return id === undefined ? undefined : [id];
  };
  const yearT = (s: string) => {
    const y = noteYear(s);
    return y === null ? null : utc(y);
  };

  await link('WDIfootnote.csv', n => {
    const t = yearT(n.Year);
    return t === null ? null : { series: one(n.CountryCode, n.SeriesCode), t };
  });
  await link('WDIcountry-series.csv', n => ({ series: one(n.CountryCode, n.SeriesCode), t: null }));
  // Series notes carry a year but no country: they apply to every country's point that year.
  await link('WDIseries-time.csv', n => {
    const t = yearT(n.Year);
    const m = metrics.get(code(n.SeriesCode));
    return t === null ? null : { series: m === undefined ? undefined : byMetric.get(m), t };
  });

  const flagged = ctx.history.prepare(`
    UPDATE ts_point SET flags = flags | ${PointFlag.footnoted}
    FROM (SELECT DISTINCT n.series_id, n.t FROM ts_point_note n JOIN ts_series s USING (series_id) WHERE s.source_id = ? AND n.t > -8.64e15) AS f
    WHERE ts_point.series_id = f.series_id AND ts_point.t = f.t
  `).run(src).changes;
  rep.extra.notes = { ...counts, distinct_texts: noteIds.size, footnoted_points: flagged };
}

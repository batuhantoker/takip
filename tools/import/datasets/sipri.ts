import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Prec } from '@takip/core/time';
import { type MetricInput, PointFlag } from '@takip/db';
import { type Ctx, importDataset } from '../context';
import { utc } from '../dates';
import { SIPRI_DIR } from '../fetch-military';
import { Resolver } from '../resolver';
import { SeriesBatch } from '../series';
import { type Cell, openXlsx, type Row } from '../xlsx';

/*
 * SIPRI Military Expenditure Database (fetch.ts `sipri-milex`): the five country sheets in US dollars and shares.
 * SIPRI's terms: free to cite and chart with its credit line; reproducing over 10% of the data, or any commercial use,
 * needs SIPRI's permission and licence. The local-currency and regional-total sheets are not imported.
 */

export const DEFENCE_TOPIC = 'Public Sector: Defense & arms trade';

type SipriMetric = MetricInput & { sheet: RegExp; scale: number };

/** Shares are stored as fractions (0.044 under a 0.0% format) and dollars in millions; both are stored in base units. */
export const SIPRI_METRICS: SipriMetric[] = [
  { sheet: /^Constant \((\d{4})\) US\$$/, code: 'sipri:milex_const_usd', name: 'Military expenditure, constant {base} US$ (SIPRI)', unit: 'US$', agg: 'sum', scale: 1e6, topic: DEFENCE_TOPIC, granularity: 'year' },
  { sheet: /^Current US\$$/, code: 'sipri:milex_usd', name: 'Military expenditure, current US$ (SIPRI)', unit: 'US$', agg: 'sum', scale: 1e6, topic: DEFENCE_TOPIC, granularity: 'year' },
  { sheet: /^Share of GDP$/, code: 'sipri:milex_gdp', name: 'Military expenditure, share of GDP (SIPRI)', unit: '% of GDP', scale: 100, topic: DEFENCE_TOPIC, granularity: 'year' },
  { sheet: /^Per capita$/, code: 'sipri:milex_pc', name: 'Military expenditure per person, current US$ (SIPRI)', unit: 'US$', scale: 1, topic: DEFENCE_TOPIC, granularity: 'year' },
  { sheet: /^Share of Govt\.? spending$/, code: 'sipri:milex_gov', name: 'Military expenditure, share of government spending (SIPRI)', unit: '% of government spending', scale: 100, topic: DEFENCE_TOPIC, granularity: 'year' },
];

/** The metric a sheet holds; the constant-dollar sheet's base year ("Constant (2024) US$") moves with each release. */
export function metricFor(m: SipriMetric, sheetName: string): MetricInput | null {
  const match = m.sheet.exec(sheetName);
  if (!match) return null;
  const metric: MetricInput = { code: m.code, name: m.name, unit: m.unit, agg: m.agg, topic: m.topic, granularity: m.granularity };
  const base = match[1] ? Number(match[1]) : null;
  return base ? { ...metric, name: metric.name.replace('{base}', String(base)), attrs: { base_year: base } } : metric;
}

/** "SIPRI-Milex-data-1949-2025_v1.2.xlsx" → "1949–2025 v1.2". */
export function versionOf(file: string) {
  const m = /SIPRI-Milex-data-(\d{4})-(\d{4})(?:_v(\d+(?:\.\d+)*))?/.exec(basename(file));
  return m ? `${m[1]}–${m[2]}${m[3] ? ` v${m[3]}` : ''}` : basename(file);
}

const BLUE = new Set(['indexed:12', 'rgb:FF0000FF']);
const RED = new Set(['indexed:10', 'rgb:FFFF0000']);
const UNAVAILABLE = new Set(['...', '…', '. .', '..']);

export type Reading = { v: number; flags: number; uncertain: boolean } | { none: 'unavailable' | 'not independent' } | { bad: string };

/** Blue figures are SIPRI estimates, red ones highly uncertain; "..." (data unavailable) and "xxx" (not independent) carry no value. */
export function readCell(c: Cell, scale: number): Reading {
  const s = c.v.trim();
  if (UNAVAILABLE.has(s)) return { none: 'unavailable' };
  if (s === 'xxx') return { none: 'not independent' };
  const v = Number(s);
  if (!c.num || !Number.isFinite(v)) return { bad: s };
  const uncertain = !!c.colour && RED.has(c.colour);
  const estimated = !!c.colour && BLUE.has(c.colour);
  return { v: v * scale, flags: (estimated ? PointFlag.estimated : 0) | (uncertain ? PointFlag.footnoted : 0), uncertain };
}

export type Table = { header: number; notes: number | null; years: Map<number, number>; rows: Row[] };

/** The header row (first cell "Country") names the notes and year columns; the rows below it are the table. */
export function readTable(rows: Row[]): Table | null {
  const at = rows.findIndex(r => r.cells.get(1)?.v.trim() === 'Country');
  if (at < 0) return null;
  let notes: number | null = null;
  const years = new Map<number, number>();
  for (const [col, c] of rows[at].cells) {
    const label = c.v.trim();
    if (label === 'Notes') notes = col;
    else if (/^\d{4}$/.test(label)) years.set(col, Number(label));
  }
  return { header: rows[at].r, notes, years, rows: rows.slice(at + 1) };
}

export const SYMBOLS = ['†', '‡', '§', '¶', '‖'];

/** "‡§¶16" → the special notes ‡, § and ¶ and footnote 16; `rest` is whatever else the cell holds. */
export function noteMarks(s: string) {
  const marks = [...s.matchAll(/[†‡§¶‖]|\d+/g)].map(m => m[0]);
  return { marks, rest: s.replace(/[†‡§¶‖]|\d+/g, '').trim() };
}

/** The Footnotes sheet: a symbol or a number in the first column, its text in the last filled one. */
export function footnotes(rows: Row[]) {
  const out = new Map<string, string>();
  for (const r of rows) {
    const key = r.cells.get(1)?.v.trim();
    const last = Math.max(...r.cells.keys());
    if (key && last > 1 && (SYMBOLS.includes(key) || /^\d+$/.test(key))) out.set(key, r.cells.get(last)!.v.trim());
  }
  return out;
}

/** Rows whose early years belong to another polity than the one the name resolves to: [last such year, its key]. */
export const DATED: Record<string, [lastYear: number, key: string]> = {
  // Footnote 79: "The figures up to 2005 are for the State Union of Serbia and Montenegro".
  Serbia: [2005, 'hist:SCG'],
  // West Germany until unification, as COW codes it (260); the GDR has its own row.
  Germany: [1990, 'hist:BRD'],
};

export const datedKey = (name: string, year: number) => {
  const d = DATED[name];
  return d && year <= d[0] ? d[1] : undefined;
};

/** The polity a country row's figure for `year` belongs to. */
export function subjectOf(r: Resolver, country: string, year: number) {
  const key = datedKey(country, year);
  return key ? r.key(key) : r.byName(country, utc(year), { politiesOnly: true });
}

/** Region and subregion headings; in some sheets they carry a row of "...". */
const REGIONS = new Set([
  'Africa', 'North Africa', 'sub-Saharan Africa', 'Americas', 'Central America and the Caribbean', 'North America', 'South America',
  'Asia & Oceania', 'Oceania', 'South Asia', 'East Asia', 'South East Asia', 'Central Asia', 'Europe', 'Central Europe',
  'Eastern Europe', 'Western Europe', 'Middle East',
]);

/** Footnote 103: spending by the EU's own institutions, not its members' sum, so it isn't region:eu27's. */
const NOT_A_STATE: Record<string, string> = { 'European Union': 'EU institutions’ own spending (footnote 103), not a state' };

/** Footnote 80: SIPRI has no dollar figures for Yugoslavia, yet the current-US$ sheet shows 0 where local currency has values. */
export const ZERO_IS_MISSING = new Set(['Yugoslavia']);

export function sipriFile() {
  const xlsx = existsSync(SIPRI_DIR) ? readdirSync(SIPRI_DIR).filter(f => f.endsWith('.xlsx')) : [];
  return xlsx.length === 1 ? join(SIPRI_DIR, xlsx[0]) : null;
}

const UNCERTAIN_NOTE = 'SIPRI marks this figure as highly uncertain (red in the database).';
const seriesKey = (metricId: number, subjectId: number) => `${metricId}|${subjectId}`;

export async function importSipri(ctx: Ctx) {
  const file = sipriFile();
  if (!file) {
    ctx.log(`sipri-milex: skipped; run \`npx tsx tools/import/fetch.ts sipri-milex\` (one .xlsx in ${SIPRI_DIR})`);
    return;
  }
  const book = openXlsx(file);
  const asOf = book.modified()?.slice(0, 10);
  if (!asOf) throw new Error(`${file}: no modified date in docProps/core.xml`);
  await importDataset(ctx, { source: 'sipri-milex', version: versionOf(file), asOf, files: [file], importerVersion: '1' }, async ds => {
    const rep = ds.report;
    const r = new Resolver(ctx);
    const batch = new SeriesBatch(ctx, ds);
    const notesSheet = book.names.find(n => /^Footnotes/.test(n));
    const texts = notesSheet ? footnotes(book.rows(notesSheet)) : new Map<string, string>();
    /** Country row name → its subjects and its notes' texts, for linking once the series exist. */
    const countries = new Map<string, { subjects: Set<number>; notes: Set<string> }>();
    const uncertain: { metricId: number; subjectId: number; t: number }[] = [];
    const counts = { estimated: 0, uncertain: 0, zero_is_missing: 0 };
    const sheets: Record<string, string> = {};

    for (const m of SIPRI_METRICS) {
      const name = book.names.find(n => m.sheet.test(n));
      const metric = name && metricFor(m, name);
      const table = name ? readTable(book.rows(name)) : null;
      if (!metric || !table) throw new Error(`${file}: no sheet with a Country header for ${m.code}`);
      sheets[m.code] = name;
      const metricId = batch.metric(metric);
      for (const row of table.rows) {
        const country = row.cells.get(1)?.v.trim();
        const cells = [...table.years].map(([col, year]) => [year, row.cells.get(col)] as const).filter((x): x is [number, Cell] => !!x[1]);
        if (!country || !cells.length || REGIONS.has(country)) continue;
        if (NOT_A_STATE[country]) {
          rep.reject(NOT_A_STATE[country], `${name}: ${country}`);
          continue;
        }
        rep.rows++;
        const entry = countries.get(country) ?? { subjects: new Set<number>(), notes: new Set<string>() };
        countries.set(country, entry);
        const marked = table.notes === null ? '' : (row.cells.get(table.notes)?.v.trim() ?? '');
        const { marks, rest } = noteMarks(marked);
        if (rest) rep.sentinel(`notes cell "${rest}" (${name}: ${country}) → ignored`);
        for (const mark of marks) {
          const text = texts.get(mark);
          if (text) entry.notes.add(text);
          else rep.miss(`sipri footnote ${mark}`);
        }
        for (const [year, cell] of cells) {
          const reading = readCell(cell, m.scale);
          if ('none' in reading) {
            rep.sentinel(`${reading.none} → no point`);
            continue;
          }
          if ('bad' in reading) {
            rep.reject('not a number', `${name}: ${country} ${year} "${reading.bad}"`);
            continue;
          }
          if (reading.v === 0 && ZERO_IS_MISSING.has(country)) {
            counts.zero_is_missing++;
            continue;
          }
          const t = utc(year);
          const subject = subjectOf(r, country, year);
          if (subject === undefined) {
            rep.miss(`sipri:${country}`);
            continue;
          }
          entry.subjects.add(subject);
          batch.add(metricId, 'entity', subject, { t, prec: Prec.year, v: reading.v, flags: reading.flags });
          if (reading.flags & PointFlag.estimated) counts.estimated++;
          if (reading.uncertain) {
            counts.uncertain++;
            uncertain.push({ metricId, subjectId: subject, t });
          }
        }
      }
    }
    const publish = batch.finish();

    const src = ds.sourceId;
    const seriesIds = new Map<string, number>();
    const bySubject = new Map<number, number[]>();
    for (const s of ctx.history.prepare(`SELECT series_id AS id, metric_id AS m, subject_id AS e FROM ts_series WHERE source_id = ? AND subject_type = 'entity'`)
      .iterate(src) as Iterable<{ id: number; m: number; e: number }>) {
      seriesIds.set(seriesKey(s.m, s.e), s.id);
      bySubject.set(s.e, [...(bySubject.get(s.e) ?? []), s.id]);
    }
    let links = 0;
    ctx.history.transaction(() => {
      ctx.history.prepare(`DELETE FROM ts_point_note WHERE series_id IN (SELECT series_id FROM ts_series WHERE source_id = ?)`).run(src);
      // A country's notes say what all its figures cover, so each goes on every series of the country.
      for (const { subjects, notes } of countries.values()) {
        for (const text of notes) {
          const note = ctx.series.note(text);
          for (const subject of subjects) for (const id of bySubject.get(subject) ?? []) {
            ctx.series.linkNote(id, null, note);
            links++;
          }
        }
      }
      const note = ctx.series.note(UNCERTAIN_NOTE);
      for (const p of uncertain) {
        const id = seriesIds.get(seriesKey(p.metricId, p.subjectId));
        if (id !== undefined) ctx.series.linkNote(id, p.t, note);
      }
    })();
    rep.extra.sheets = sheets;
    rep.extra.flags = counts;
    rep.extra.notes = { footnotes: texts.size, country_links: links, uncertain_points: uncertain.length };
    rep.extra.not_imported = book.names.filter(n => !Object.values(sheets).includes(n) && n !== notesSheet);
    return publish;
  });
}

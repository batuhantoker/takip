import { join } from 'node:path';
import { DIR, read, type Row, wdPoint } from '../datasets/wikidata';
import type { Point } from './geo-index';
import type { Evidence } from './resolve';

/* The fetch.ts Wikidata rows (docs/data/raw-2026-10-12-more/wikidata) as resolver evidence, for the importers and the benchmark. */

// Re-exported, not copied: datasets/wikidata.ts reaches this file through wikidata-recover.ts, and a live binding survives the cycle.
export { DIR as WIKIDATA_DIR, readSitelinks, type Row, wdPoint } from '../datasets/wikidata';

/** Raw file → the history.db source that imports it. */
export const FILES: Record<string, string> = {
  battles: 'wikidata-battles',
  wars: 'wikidata-wars',
  massacres: 'wikidata-massacres',
  revolutions: 'wikidata-revolutions',
  attacks: 'wikidata-attacks',
  politics: 'wikidata-politics',
  displacements: 'wikidata-displacements',
};

const NAVAL = 'Q1261499';

export const readRows = (file: string): Row[] => read<Row[]>(join(DIR, `${file}.json`));

/** The astronomical year of "<xsd time>/<precision>", the finer of point in time and start time. */
export function wdYear(r: Row): number | null {
  for (const v of [r.t0, r.t, r.inception]) {
    const m = v?.match(/^(-?)(\d+)-/);
    if (m) return Number(m[2]) * (m[1] ? -1 : 1);
  }
  return null;
}

/** Every geocoded row's point, by the wars it lists, so a battle's siblings can be found. */
export const warPoints = (files: string[]) => warPointsOf(files.map(f => [f, readRows(f)]));

export function warPointsOf(byFile: Iterable<readonly [file: string, rows: Row[]]>): Map<string, { item: string; p: Point }[]> {
  const out = new Map<string, { item: string; p: Point }[]>();
  for (const [f, rows] of byFile) {
    for (const r of rows) {
      const p = wdPoint(r.coord) ?? wdPoint(r.locCoord);
      if (!p) continue;
      for (const w of r.wars?.split('|') ?? []) out.set(w, [...(out.get(w) ?? []), { item: r.item, p }]);
      if (f === 'wars') out.set(r.item, [...(out.get(r.item) ?? []), { item: r.item, p }]);
    }
  }
  return out;
}

/** Wars with more geocoded events than this (the world wars) say nothing about where one battle was. */
const MAX_SIBLINGS = 400;

/**
 * What a row without coordinates carries: its labels and article titles, description, year, the other events of its
 * wars. `keepPlace` adds the country and location coordinates the importers use, for rows that have them.
 */
export function rowEvidence(r: Row, sitelinks: Record<string, Record<string, string>>, wars: Map<string, { item: string; p: Point }[]>, keepPlace = false): Evidence {
  const titles: { text: string; lang?: string }[] = [];
  if (r.label) titles.push({ text: r.label, lang: 'en' });
  if (r.otherLabel && r.otherLabel !== r.label) titles.push({ text: r.otherLabel });
  const en = r.article?.match(/\/\/en\.wikipedia\.org\/wiki\/(.+)$/)?.[1];
  const enTitle = en ? decodeURIComponent(en).replace(/_/g, ' ') : null;
  if (enTitle && enTitle !== r.label) titles.push({ text: enTitle, lang: 'en' });
  for (const [site, title] of Object.entries(sitelinks[r.item] ?? {})) titles.push({ text: title, lang: site.replace(/wiki$/, '') });
  const related: Point[] = [];
  // Its own events (a war's battles) and its siblings (the other battles of its war).
  for (const w of [r.item, ...(r.wars?.split('|') ?? [])]) {
    const sib = wars.get(w) ?? [];
    if (sib.length > MAX_SIBLINGS) continue;
    for (const s of sib) if (s.item !== r.item) related.push(s.p);
  }
  return {
    qid: r.item,
    articles: [...(enTitle ? [{ wiki: 'en', title: enTitle }] : []), ...Object.entries(sitelinks[r.item] ?? {}).map(([wiki, title]) => ({ wiki, title }))],
    titles,
    description: r.desc ?? null,
    year: wdYear(r),
    related,
    naval: r.classes?.split('|').includes(NAVAL),
    ...(keepPlace && { countryPoint: wdPoint(r.countryCoord) ?? wdPoint(r.capital?.split(' ').slice(1).join(' ')) }),
  };
}

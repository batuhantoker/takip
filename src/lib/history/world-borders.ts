import { activeIntl, t } from '@/lib/core/i18n/active';
import { msg, type Vars } from '@/lib/core/i18n/translator';
import { htmlEsc, pop, urlSafe } from '@/lib/map/popups/kit';
import { MAP_INK } from '@/lib/map/style/tokens';
import { yearLabel } from '@/lib/map/replay/timeline-ticks';
import { summaryHtml } from './popup';
import { languageName } from '@/lib/core/wikipedia/language';
import { articleRef, refFromUrl } from '@/lib/core/wikipedia/refs';
import type { ArticleSummary } from './wiki';

/*
 * World borders in History, from Seshat's Cliopatria: the world's polities year by year, 3400 BCE to 2024
 * (tools/import/datasets/cliopatria.ts). A year's borders hold for the whole year; the 2024 ones stay on after it.
 */

/** Cliopatria's first and last years, as the clock counts them (0 is 1 BCE). */
export const FIRST_YEAR = -3400;
export const LAST_YEAR = 2024;

const bce = (y: number) => 1 - y;

export function yearStart(year: number) {
  const d = new Date(0);
  d.setUTCFullYear(year, 0, 1);
  return d.getTime();
}

/** The clock's year at `t`, epoch ms. */
export const clockYear = (t: number) => new Date(t).getUTCFullYear();

/** "500 BCE", "1914". */
export const clockYearLabel = (y: number, say?: (source: string, vars?: Vars) => string) => yearLabel(y > 0 ? y : y - 1, say);

const YEAR_S = 365.2425 * 86_400;

export const WORLD_BORDERS = {
  code: 'world-borders',
  label: msg('World borders'),
  /** Play runs from classical Greece to the last year. */
  playYears: `500 BCE–${LAST_YEAR}`,
  start: yearStart(bce(500)),
  end: yearStart(LAST_YEAR + 1),
  speed: 25 * YEAR_S,
  view: { lat: 30, lng: 20, zoom: 1.5 },
};

/** Years per fetch: borders change slowly before 1000 CE. */
const span = (year: number) => (year < 1000 ? 100 : 20);

/**
 * What to fetch at `t`, epoch ms: the span holding it and the next, so playback never waits on a fetch. `next` is
 * when to fetch again; null before the first year.
 */
export function borderWindow(t: number): { from: number; next: number; to: number } | null {
  const y = clockYear(t);
  if (y < FIRST_YEAR) return null;
  const s = span(y);
  const lo = Math.floor(y / s) * s;
  return { from: yearStart(lo), next: yearStart(lo + s), to: yearStart(lo + 2 * s) };
}

const PALETTE = [MAP_INK.blue, MAP_INK.violet, MAP_INK.teal, MAP_INK.rose, MAP_INK.sand, MAP_INK.amber, MAP_INK.green, MAP_INK.red, MAP_INK.slate];

/** A power's colour, the same in every year it appears; its colonies and member states share it. */
export function powerColor(power: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < power.length; i++) h = Math.imul(h ^ power.charCodeAt(i), 0x01000193);
  return PALETTE[(h >>> 0) % PALETTE.length];
}

/** Feature properties as /api/replay/history/features sends them; times are epoch seconds. */
export type WorldBorderFeature = {
  id: number;
  name: string;
  /** The empire or union it belongs to (Cliopatria's MemberOf). */
  subject: string | null;
  wiki: string | null;
  wikidata: string | null;
  t0: number;
  t1: number | null;
};

/** "1914", "1924 – 1935", or "since 2006" for borders still standing at the data's end; t1 starts the year after. */
export function yearsSpan(t0: number, t1: number | null): string {
  const first = clockYearLabel(clockYear(t0 * 1000), t);
  // Map features drop null properties, so an open end can arrive as undefined.
  if (t1 == null) return t('since {date}', { date: first });
  const last = clockYearLabel(clockYear(t1 * 1000) - 1, t);
  return last === first ? first : `${first} – ${last}`;
}

/** The Wikipedia article Cliopatria names for the polity, as /api/history/wiki takes it. */
export const articleOf = (p: WorldBorderFeature) => (p.wiki ? refFromUrl(p.wiki) : null);

/** What lands after the popup opens: the article, and whether its summary is open in full. */
export type BorderExtras = { wiki?: ArticleSummary | null; expanded?: boolean };

/** A polity's picture is mostly a flag or a map, so it sits small beside the article's name. */
function articleHtml(w: ArticleSummary): string {
  const img = w.image ? `<img class="tk-pop-thumb" src="${urlSafe(w.image.src)}" alt="" />` : '';
  return `<div class="tk-pop-wiki tk-pop-article">${img}<div>
    <div class="tk-pop-item-title">${htmlEsc(w.title)}</div>
    ${w.description ? `<div class="tk-pop-list-meta">${htmlEsc(w.description)}</div>` : ''}
  </div></div>`;
}

export function worldBorderPopupHtml(p: WorldBorderFeature, x: BorderExtras = {}): string {
  const whole = p.subject && p.subject !== p.name ? p.subject : null;
  const w = x.wiki;
  const ref = articleOf(p);
  const lang = w?.lang ?? (ref ? articleRef(ref).lang : 'en');
  const extract = w?.extract.trim();
  const story = w ? articleHtml(w) + (extract ? summaryHtml(extract, !!x.expanded) : '') : '';
  return pop({
    kicker: whole ? t('Part of {name}', { name: whole }) : t('Polity'),
    dot: powerColor(p.subject ?? p.name),
    title: p.name,
    rows: [{ label: t('These borders'), value: yearsSpan(p.t0, p.t1) }],
    foot: story ? `<div class="tk-pop-body">${story}</div>` : undefined,
    links: [
      w || p.wiki
        ? { href: w?.url ?? p.wiki, label: lang === 'en' ? 'Wikipedia' : t('{language} Wikipedia', { language: languageName(lang, activeIntl()) }) }
        : { href: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(p.name)}`, label: t('Search Wikipedia') },
      /^Q\d+$/.test(p.wikidata ?? '') && { href: `https://www.wikidata.org/wiki/${p.wikidata}`, label: 'Wikidata' },
    ],
  });
}

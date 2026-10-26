import { clauseCut } from '@takip/core/headline';
import { Prec } from '@takip/core/time';
import type { Translate } from '@/lib/core/i18n/translator';
import {
  attackRows, facts, formatAt, HISTORY_FAMILIES, KINDS, longDescription, placementNote, when, withoutDescription, type HistoryDetail, type HistoryFeature,
} from '@/lib/history/popup';
import { popCoords } from '@/lib/map/popups/kit';
import { HISTORY_FAMILY_LINKS, type HistoryFamilyLink } from '@/lib/map/view-mode-link';
import { mapHref } from '../map-link';
import type { EventPage, EventRef } from './event-page';

/**
 * An event page's words, from the data and History's popup helpers, so the page and the popup say the same thing
 * the same way: dates at their precision, deaths with their range, how the event was placed.
 */

export const kindLabel = (t: Translate, kind: string) => (KINDS[kind] ? t(KINDS[kind]) : kind);

const feature = (e: EventPage | EventRef): HistoryFeature => ({
  id: 0, kind: e.kind, family: e.family, title: e.title, t0: e.t0, t1: e.t0, prec: e.prec, ongoing: 0, geoPrec: 0, magnitude: e.magnitude,
});

const detail = (e: EventPage): HistoryDetail => ({
  id: e.id, kind: e.kind, family: e.family, title: e.title, t0: e.t0, t1: e.t1, prec: e.prec, ongoing: e.ongoing, geoPrec: e.geoPrec,
  magnitude: e.magnitude, tStart: e.tStart, tEnd: e.tEnd, endPrec: e.endPrec, attrs: e.attrs,
});

/** "1 Jul 1916", "1914 – 1918", "since 2011", at each end's own precision. */
export const eventWhen = (t: Translate, e: EventPage) => when({ ...feature(e), t0: e.tStart, ongoing: e.ongoing }, detail(e), t, t.intl);

/** Years only, for the title: "1914 – 1918", "480 BCE". */
export function eventYears(t: Translate, e: EventPage): string {
  const year = (s: number, prec: number) => formatAt(s, Math.min(prec, Prec.year), t, t.intl);
  const start = year(e.tStart, e.prec);
  if (e.ongoing) return t('since {date}', { date: start });
  const end = e.tEnd === null ? start : year(e.tEnd, e.endPrec ?? e.prec);
  return end === start ? start : `${start} – ${end}`;
}

export const refWhen = (t: Translate, r: EventRef) => formatAt(r.t0, r.prec, t, t.intl);

export const eventName = (t: Translate, e: EventPage | EventRef) => e.title ?? kindLabel(t, e.kind);

const HEADING = 70;
const HEADING_CJK = 32;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** The name as a page heading: a sentence-long title goes by its first clauses, and summaryText shows it whole. */
export function eventHeading(t: Translate, e: EventPage): string {
  const name = eventName(t, e);
  const max = CJK.test(name) ? HEADING_CJK : HEADING;
  return name.length > max ? clauseCut(name.replace(/…$/, ''), max) ?? name : name;
}

const num = (t: Translate, n: number) => Math.round(n).toLocaleString(t.intl);

/** The family's measure ("Deaths 1,200 (900–1,500)"), as the popup shows it; null where the source gave none. */
export function magnitudeRow(t: Translate, e: EventPage | EventRef, range?: unknown): { label: string; value: string } | null {
  const family = HISTORY_FAMILIES[e.family];
  if (typeof e.magnitude !== 'number' || !family?.magnitude) return null;
  const span = Array.isArray(range) && range.length === 2 && range.every(n => typeof n === 'number') ? ` (${num(t, range[0])}–${num(t, range[1])})` : '';
  return { label: t(family.magnitude), value: (e.family === 'hazard' ? e.magnitude.toFixed(1) : num(t, e.magnitude)) + span };
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() && v !== 'Unknown' ? v.trim() : null);

/** The place as the source names it, where it names one. */
export function placeName(e: EventPage): string | null {
  const a = e.attrs;
  const where = Array.isArray(a.where) ? a.where.filter(x => typeof x === 'string').join(', ') : null;
  const gtd = [text(a.city), text(a.provstate)].filter((x, i, xs): x is string => !!x && xs.indexOf(x) === i).join(', ');
  return text(a.place) ?? text(a.site) ?? (where || null) ?? (gtd || null) ?? text(a.country) ?? text(a.territory);
}

export const coordinates = (e: EventPage) => (e.lat !== null && e.lon !== null ? popCoords(e.lat, e.lon, 2) : null);

/** How the event was put on the map, in the popup's words; null for an exact place. */
export const placement = (t: Translate, e: EventPage) => placementNote(t, e.geoPrec, e.family, e.magnitude, e.attrs) || null;

/** The facts the record carries, as label and value, uncut; GTD's coded columns in words. */
export function factRows(t: Translate, e: EventPage): { label: string; value: string }[] {
  const rows = e.kind === 'attack.terror'
    ? attackRows(e.attrs, t, t.intl).map(r => ({ label: r.label, value: r.value === null || r.value === undefined ? '' : String(r.value) }))
    : facts(longDescription(e.title, e.attrs) ? withoutDescription(e.attrs) : e.attrs, t, Infinity).map(([label, value]) => ({ label, value }));
  return rows.filter(r => r.value);
}

/** GTD's own summary of an attack, without the date it opens with. */
export const recordSummary = (e: EventPage) => (e.kind === 'attack.terror' ? text(e.attrs.summary)?.replace(/^[\d/]+:\s*/, '') ?? null : null);

/** What the page shows as the summary: GTD's, a year page's whole line where the title is the start of it, or the title a shorter heading was cut from. */
export const summaryText = (e: EventPage, heading: string) =>
  recordSummary(e) ?? longDescription(e.title, e.attrs) ?? (e.title && e.title !== heading && e.title.startsWith(heading) ? e.title : null);

const ZOOM: Record<number, number> = { 0: 6, 1: 6, 2: 5.5, 3: 5, 4: 4.5, 5: 3.5 };
const FIRST_YEAR = -3000;

const startYear = (e: EventPage) => new Date(e.tStart * 1000).getUTCFullYear();
const openYear = (e: EventPage) => Math.max(FIRST_YEAR, Math.min(new Date().getUTCFullYear(), startYear(e)));

/** The map link's label, naming the year History opens at ("See 480 BCE on the map"), where that is the event's own. */
export function eventOpenLabel(t: Translate, e: EventPage): string {
  if (openYear(e) !== startYear(e)) return t('Open on the map');
  return t('See {year} on the map', { year: formatAt(e.tStart, Math.min(e.prec, Prec.year), t, t.intl) });
}

/** History at the event's year and place, with its family switched on. */
export function eventOpenPath(e: EventPage): string {
  const year = openYear(e);
  const family = (HISTORY_FAMILY_LINKS as readonly string[]).includes(e.family) ? [e.family as HistoryFamilyLink] : undefined;
  return mapHref({
    layers: [],
    view: e.lat !== null && e.lon !== null ? { lat: e.lat, lon: e.lon, zoom: ZOOM[e.geoPrec] ?? 5 } : undefined,
    mode: { view: 'history', year, layer: null, ...(family ? { families: family } : {}) },
  });
}

/** ISO 8601 at the stated precision, astronomical years (0000 is 1 BCE), for schema.org. */
export function isoDate(s: number, prec: number): string {
  const d = new Date(s * 1000);
  const y = d.getUTCFullYear();
  const year = `${y < 0 ? '-' : ''}${String(Math.abs(y)).padStart(4, '0')}`;
  if (prec <= Prec.year) return year;
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return prec === Prec.month ? `${year}-${month}` : `${year}-${month}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

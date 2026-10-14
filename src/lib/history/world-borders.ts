import { pop } from '@/lib/map/popups/kit';
import { MAP_INK } from '@/lib/map/tokens';
import { yearLabel } from '@/lib/replay/timeline-ticks';

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
export const clockYearLabel = (y: number) => yearLabel(y > 0 ? y : y - 1);

const YEAR_S = 365.2425 * 86_400;

export const WORLD_BORDERS = {
  code: 'world-borders',
  label: 'World borders',
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
  const first = clockYearLabel(clockYear(t0 * 1000));
  if (t1 === null) return `since ${first}`;
  const last = clockYearLabel(clockYear(t1 * 1000) - 1);
  return last === first ? first : `${first} – ${last}`;
}

export function worldBorderPopupHtml(p: WorldBorderFeature): string {
  const whole = p.subject && p.subject !== p.name ? p.subject : null;
  return pop({
    kicker: whole ? `Part of ${whole}` : 'Polity',
    dot: powerColor(p.subject ?? p.name),
    title: p.name,
    rows: [{ label: 'These borders', value: yearsSpan(p.t0, p.t1) }],
    note: 'Cliopatria, Seshat Global History Databank (CC BY 4.0). Drawn for world scale.',
    links: [
      p.wiki ? { href: p.wiki, label: 'Wikipedia' } : { href: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(p.name)}`, label: 'Search Wikipedia' },
      /^Q\d+$/.test(p.wikidata ?? '') && { href: `https://www.wikidata.org/wiki/${p.wikidata}`, label: 'Wikidata' },
    ],
  });
}

import { expand, Prec } from '@takip/core/time';
import { utc } from '../dates';
import type { GeoIndex } from '../geo/geo-index';
import { placeNames } from '../geo/names';
import { type YearsBullet, type YearsFile, target } from './file';
import type { EventDates } from './event-dates';
import { classKind } from './kinds';
import type { Known, KnownEvents } from './known';
import type { BulletDate, DatePrec } from './parse';
import { classify, type Linked } from './place';

/* A fetched bullet with its links read against the geo index and TAKIP's events: which link is the event it is about. */

export const PREC: Record<DatePrec, Prec> = { day: Prec.day, month: Prec.month, year: Prec.year, decade: Prec.decade, century: Prec.century };

/** The bullet's start and, for a stated range, end, as the event store takes them. */
export function bulletTime(d: BulletDate): { tStart: number; tStartPrec: Prec; tEnd: number | null; tEndPrec: Prec | null } {
  const tStart = utc(d.y, d.m ?? 1, d.d ?? 1);
  if (d.y2 === undefined) return { tStart, tStartPrec: PREC[d.prec], tEnd: null, tEndPrec: null };
  const endPrec = d.d2 ? Prec.day : d.m2 ? Prec.month : Prec.year;
  return { tStart, tStartPrec: PREC[d.prec], tEnd: utc(d.y2, d.m2 ?? 1, d.d2 ?? 1), tEndPrec: endPrec };
}

/** The interval a bullet's date covers, widened for calendar slips: Julian dates before 1924 run up to 13 days behind. */
export function bulletSpan(d: BulletDate): { lo: number; hi: number } {
  const t = bulletTime(d);
  const lo = expand(t.tStart, t.tStartPrec).lo;
  const hi = t.tEnd !== null ? expand(t.tEnd, t.tEndPrec!).hi : expand(t.tStart, t.tStartPrec).hi;
  const slack = (d.prec === 'day' ? (d.y < 1924 ? 14 : 1) : 0) * 86_400_000;
  return { lo: lo - slack, hi: hi + slack };
}

const YEAR_MS = 366 * 86_400_000;
/** Wars and other long spans aren't what a dated bullet is about; a battle in them is. */
const LONG_KINDS = new Set(['war', 'conflict.rebellion']);

export const isLong = (k: Known) => k.tHi - k.tLo > YEAR_MS || LONG_KINDS.has(k.kind) || k.kind.startsWith('war.');

/** Whether a known event and a bullet's date can be the same occurrence. */
export function sameTime(d: BulletDate, k: Known): boolean {
  const s = bulletSpan(d);
  return s.lo < k.tHi && k.tLo < s.hi;
}

/** Whether two bullets' dates can be one occurrence. */
export function datesMeet(a: BulletDate, b: BulletDate): boolean {
  const x = bulletSpan(a);
  const y = bulletSpan(b);
  return x.lo < y.hi && y.lo < x.hi;
}

export type Prepared = {
  links: Linked[];
  ctx: Linked[];
  /** The first linked event of a day or a few months, in TAKIP, in the geo index, or named like one ("Siege of X"), dated as the bullet is. */
  main: Linked | null;
  /** TAKIP events about the main link, of any date. */
  known: Known[];
  /** The main link's kind from its Wikidata class. */
  kind: string | null;
};

const qnum = (q: string | undefined) => (q ? Number(q.slice(1)) : null);

/** The geo index's class and GeoNames kind lookups the Linker takes. */
export function indexLookups(db: { prepare: (sql: string) => { pluck: () => { get: (...a: unknown[]) => unknown } } }) {
  const cls = db.prepare(`SELECT class FROM item WHERE qid = ?`).pluck();
  const gn = db.prepare(`SELECT kind FROM place WHERE qid = ? AND source = 'geonames' ORDER BY population DESC LIMIT 1`).pluck();
  return { classOf: (q: number) => (cls.get(q) as number | undefined) ?? null, gnKindOf: (q: number) => (gn.get(q) as string | undefined) ?? null };
}

/** Classifies each link of a file once. */
export class Linker {
  private cache = new Map<number, { linked: Linked; known: Known[]; kind: string | null; long: boolean }>();

  constructor(
    private readonly index: GeoIndex,
    private readonly file: YearsFile,
    private readonly knownEvents: KnownEvents,
    private readonly classRoots: Record<string, string[]>,
    private readonly classOf: (qid: number) => number | null,
    private readonly gnKindOf: (qid: number) => string | null = () => null,
    private readonly dates: EventDates = {},
  ) {}

  link(i: number) {
    let c = this.cache.get(i);
    if (c) return c;
    const l = this.file.links[i];
    const title = target(l);
    const qid = l.x ? null : qnum(l.q);
    const item = qid !== null ? this.index.item(qid) : null;
    // An event row that carries a place's article (a border change's territory) isn't the place.
    const known = item && item.kind !== 'event' && item.kind !== null ? [] : this.knownEvents.find(qid, this.file.lang, title);
    const cls = qid !== null ? this.classOf(qid) : null;
    const kind = classKind(this.classRoots, cls !== null ? `Q${cls}` : null);
    const named = placeNames(title, this.file.lang).length > 0;
    const linked = classify(this.index, this.file.lang, { title, qid, cls, gnKind: qid !== null ? this.gnKindOf(qid) : null }, () => known.length > 0 || kind !== null || named);
    const long = (known.length > 0 && known.every(isLong)) || (kind !== null && LONG_KINDS.has(kind));
    c = { linked, known, kind, long };
    this.cache.set(i, c);
    return c;
  }

  prepare(b: YearsBullet): Prepared {
    const at = new Set(b.a ?? []);
    const own = b.l.map(i => {
      const x = this.link(i);
      const t = x.linked.qid !== null ? timing(b.d, this.dates[`Q${x.linked.qid}`]) : 'unknown';
      // A war named first ("Great Turkish War: the Ottomans retake Belgrade") is the setting, and an event of another
      // day ("a trial over the 2004 murder of …") is a mention: neither is what the bullet is about.
      // Only an event whose date can be checked and agrees is what the bullet is about: undated "events" were a
      // peacekeeping mission's office and "Rules of engagement" (named like a battle) put at a London restaurant.
      const aside = x.long || t === 'long' || !(x.known.length ? x.known.some(k => !isLong(k) && sameTime(b.d, k)) : t === 'agrees');
      return { ...x, aside, linked: { ...x.linked, ...(at.has(i) ? { loc: true } : {}) } };
    });
    const ctx = (b.c ?? []).map(i => this.link(i).linked);
    const main = own.find(x => x.linked.role === 'event' && !x.aside) ?? null;
    return {
      links: own.map(x => (x.aside && x.linked.role === 'event' ? { ...x.linked, role: 'none' as const } : x.linked)),
      ctx,
      main: main?.linked ?? null,
      known: main?.known ?? [],
      kind: main?.kind ?? null,
    };
  }
}

/** Wikidata precision (9 year, 10 month, 11 day) as TAKIP's. */
const WD_PREC: Record<number, Prec> = { 6: Prec.millennium, 7: Prec.century, 8: Prec.decade, 9: Prec.year, 10: Prec.month, 11: Prec.day };

function span(iso: string, wdPrec: number) {
  const [, y, m, d] = iso.match(/^(-?\d+)-(\d+)-(\d+)$/)!.map(Number);
  return expand(utc(y, m || 1, d || 1), WD_PREC[Math.min(11, Math.max(6, wdPrec))]);
}

/**
 * How a bullet's date sits with the event Wikidata dates: the same occurrence, another day, an event of over a year (a
 * setting: the bullet may be any day of it), or no date to tell.
 */
export function timing(d: BulletDate, dates: EventDates[string] | undefined): 'agrees' | 'differs' | 'long' | 'unknown' {
  if (!dates) return 'unknown';
  const a = span(dates[0], dates[1]);
  const z = dates[2] ? span(dates[2], dates[3] ?? 9) : a;
  if (z.hi - a.lo > YEAR_MS + 34 * 86_400_000) return 'long';
  const s = bulletSpan(d);
  return s.lo < z.hi && a.lo < s.hi ? 'agrees' : 'differs';
}

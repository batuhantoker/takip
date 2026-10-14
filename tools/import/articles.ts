import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { RAW_MORE } from './context';
import { wdPoint, wdTime } from './datasets/wikidata';

/** fetch.ts `articles`: Wikidata items with an English article, for importers to store as references. */
export const ARTICLES = join(RAW_MORE, 'wikidata', 'articles.json');

type Point = { lon: number; lat: number };
type Raw = Record<string, string | undefined>;
type Candidate = Point & { title: string; cls: string; t: number; prec: Prec; t1: number | null };

const DAY = 86_400_000;

export function km(a: Point, b: Point) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** At the coarser precision: a day matches the day either side (items carry local dates), a year any day in it. */
export function sameTime(a: number, ap: Prec, b: number, bp: Prec) {
  const p = Math.min(ap, bp);
  if (p < Prec.year) return false;
  if (p >= Prec.day) return Math.abs(Math.floor(a / DAY) - Math.floor(b / DAY)) <= 1;
  const da = new Date(a);
  const db = new Date(b);
  return da.getUTCFullYear() === db.getUTCFullYear() && (p < Prec.month || da.getUTCMonth() === db.getUTCMonth());
}

const year = (t: number) => new Date(t).getUTCFullYear();
const letters = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

export class Articles {
  private readonly byYear = new Map<number, Candidate[]>();
  private readonly heritage: (Point & { title: string })[] = [];
  private readonly volcanoes = new Map<string, string>();

  constructor(data: { events?: Raw[]; heritage?: Raw[]; volcanoes?: Raw[] }) {
    for (const e of data.events ?? []) {
      const at = wdPoint(e.coord) ?? wdPoint(e.locCoord);
      const start = wdTime(e.t) ?? wdTime(e.t0);
      if (!at || !start || !e.title || !e.cls) continue;
      const end = wdTime(e.t1);
      const c: Candidate = { ...at, title: e.title, cls: e.cls, t: start.t, prec: start.prec, t1: end && end.t >= start.t ? end.t : null };
      for (let y = year(c.t); y <= year(c.t1 ?? c.t); y++) {
        const list = this.byYear.get(y) ?? [];
        list.push(c);
        this.byYear.set(y, list);
      }
    }
    for (const h of data.heritage ?? []) {
      const at = wdPoint(h.coord);
      if (at && h.title) this.heritage.push({ ...at, title: h.title });
    }
    for (const v of data.volcanoes ?? []) if (v.gvp && v.title && !this.volcanoes.has(v.gvp)) this.volcanoes.set(v.gvp, v.title);
  }

  /** Null when the file hasn't been fetched: references are optional. */
  static read(path = ARTICLES): Articles | null {
    return existsSync(path) ? new Articles(JSON.parse(readFileSync(path, 'utf8'))) : null;
  }

  /**
   * The nearest article of these classes about the same time within maxKm. With `spans`, an item's start–end
   * range counts too: right for a test series, wrong for an item that groups two tests a week apart. Items dated
   * coarser than `minPrec` are skipped: "1962" would match every test fired that year.
   */
  event(classes: string[], t: number, prec: Prec, at: Point | null, maxKm: number, opts: { spans?: boolean; minPrec?: Prec } = {}): string | null {
    if (!at) return null;
    let best: { title: string; d: number } | null = null;
    for (const c of this.byYear.get(year(t)) ?? []) {
      if (!classes.includes(c.cls) || c.prec < (opts.minPrec ?? Prec.year)) continue;
      const within = opts.spans && c.t1 !== null && t >= c.t - DAY && t <= c.t1 + DAY;
      if (!within && !sameTime(t, prec, c.t, c.prec)) continue;
      const d = km(at, c);
      if (d <= maxKm && (!best || d < best.d)) best = { title: c.title, d };
    }
    return best?.title ?? null;
  }

  /**
   * A World Heritage site's article: the nearest within maxKm, else one titled with the site's name nearby (a
   * park's two points can sit far apart), else the nearest within farKm.
   */
  heritageAt(at: Point, name: string, maxKm = 3, farKm = 15): string | null {
    const key = letters(name);
    let near: { title: string; d: number } | null = null;
    let named: { title: string; d: number } | null = null;
    for (const h of this.heritage) {
      const d = km(at, h);
      if (d <= farKm && (!near || d < near.d)) near = { title: h.title, d };
      if (d <= 300 && letters(h.title) === key && (!named || d < named.d)) named = { title: h.title, d };
    }
    return (near && near.d <= maxKm ? near.title : null) ?? named?.title ?? near?.title ?? null;
  }

  /** A volcano's article by its Global Volcanism Program number. */
  volcano(gvp: string | number | null | undefined): string | null {
    return gvp == null ? null : (this.volcanoes.get(String(gvp)) ?? null);
  }
}

/** The fetched file as an import input, when it exists, so a refetch re-imports. */
export const articleFiles = (path = ARTICLES) => (existsSync(path) ? [path] : []);

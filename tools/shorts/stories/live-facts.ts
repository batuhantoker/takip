/** What a feature's feed says right now, in the same sentences its /map page prints, for a tour to tell. */
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createTranslator } from '../../../src/lib/core/i18n/translator';
import type { LayerPage, Spot } from '../../../src/lib/platform/site/catalog/types';
import type { Spoken } from '../../../src/lib/platform/site/clock';
import { auroraLine, issLine, launchLine, quakeLine } from '../../../src/lib/platform/site/live/lines';
import { arc, centre } from './facts';
import { inBox, viewBox } from './view';

const en = createTranslator('en', {});
const ROUTES = { earthquakes: '/api/earthquakes', launches: '/api/launches', aurora: '/api/aurora', iss: '/api/satellites?norad=25544' } as const;
const words = (s: Spoken) => s.map(p => (typeof p === 'string' ? p : `${new Date(p.at).toISOString().slice(11, 16)} UTC`)).join('');

type Quake = { magnitude: number; place: string; time: number; lat: number; lng: number };
export type Point = { lat: number; lng: number; offline?: boolean };

/** Point feeds a tour can count in each spot's view, keyed by the layer that draws them. */
type Feed = Partial<Record<'ships' | 'fires' | 'cameras' | 'commercial_flights' | 'private_flights' | 'private_jets' | 'military_flights', Point[]>>;
const POINTS: Record<string, { url: string; list: (json: Feed) => Point[] }> = {
  maritime: { url: '/api/maritime', list: j => j.ships ?? [] },
  fires: { url: '/api/fires', list: j => j.fires ?? [] },
  cctv: { url: '/api/cctv', list: j => (j.cameras ?? []).filter(c => !c.offline) },
  // the world feed, a few minutes behind; enough to tell a busy sky from an empty one at night
  flights: { url: '/api/flights', list: j => j.commercial_flights ?? [] },
  private: { url: '/api/flights', list: j => j.private_flights ?? [] },
  jets: { url: '/api/flights', list: j => j.private_jets ?? [] },
  military: { url: '/api/flights', list: j => j.military_flights ?? [] },
};

export interface LiveFacts {
  /** The page's live sentence, or null when the feed has nothing true to say. */
  line: string | null;
  /** A sentence per spot label, where the feed says something about that view. */
  spots: Record<string, string>;
  /** How many of the layer's points each spot's view holds, for layers that can be counted. */
  inView?: Record<string, number>;
  /** Where the live line's subject is (today's strongest quake), for the camera to be there while it is said. */
  focus?: { lat: number; lon: number };
  /** The page's feed didn't answer: a live tour shouldn't be filmed without its facts. */
  failed?: boolean;
  /** The day's busiest views of a counted feed away from the page's spots, for a long tour with too few of its own. */
  busiest?: Spot[];
}

async function feedPoints(base: string, page: LayerPage) {
  const feeds = page.layers.flatMap(l => POINTS[l] ?? []);
  if (!feeds.length) return undefined;
  const replies = new Map<string, Promise<Feed | null>>();
  for (const { url } of feeds) if (!replies.has(url)) replies.set(url, fetch(base + url, { signal: AbortSignal.timeout(120_000) }).then(r => (r.ok ? r.json() : null), () => null));
  const points: Point[] = [];
  for (const f of feeds) {
    const json = await replies.get(f.url);
    if (!json) return undefined;
    points.push(...f.list(json));
  }
  return points;
}

const countIn = (points: Point[], s: Spot) => {
  const box = viewBox(s.view.lat, s.view.lon, s.view.zoom);
  return points.filter(p => inBox(box, p.lat, p.lng)).length;
};

/** A count as a tour says it: exact under 20, else to the nearest ten. */
export const roundCount = (n: number) => (n < 20 ? n : Math.round(n / 10) * 10);

/** How many points each spot's view holds now, so a cached tour tells its counts as of its filming; undefined if the feed fails. */
export async function recount(base: string, page: LayerPage, spots: Spot[]): Promise<Record<string, number> | undefined> {
  const points = spots.length ? await feedPoints(base, page) : undefined;
  return points && Object.fromEntries(spots.map(s => [s.label, countIn(points, s)]));
}

const GAZETTEER = join(resolve(import.meta.dirname, '../../..'), 'data/db/geo-index.db');
type City = { name: string; population: number; lat: number; lon: number };
let cities: City[] | null = null;
/** The biggest city of 200,000 or more in a box, from GeoNames in data/db/geo-index.db (gitignored: this Mac only). */
function cityIn(box: [number, number, number, number]) {
  if (!cities) {
    if (!existsSync(GAZETTEER)) return null;
    const db = new Database(GAZETTEER, { readonly: true, fileMustExist: true });
    cities = db.prepare(`SELECT name, population, lat, lon FROM place WHERE kind = 'settlement' AND population >= 200000 ORDER BY population DESC`).all() as City[];
    db.close();
  }
  return cities.find(c => inBox(box, c.lat, c.lon))?.name ?? null;
}

/** Up to `n` views at `zoom` holding the most points, outside the page's own spots and each other, named for a city in them. */
export function busiestViews(points: Point[], taken: Spot[], zoom: number, n: number, name = cityIn, least = 10): Spot[] {
  const [w, s, e, nn] = viewBox(0, 0, zoom);
  const cw = e - w, ch = nn - s;
  const cells = new Map<string, Point[]>();
  for (const p of points) {
    const key = `${Math.floor(p.lat / ch)}:${Math.floor(p.lng / cw)}`;
    cells.set(key, [...(cells.get(key) ?? []), p]);
  }
  const out: Spot[] = [];
  for (const cell of [...cells.values()].sort((a, b) => b.length - a.length)) {
    if (out.length >= n || cell.length < least) break;
    const c = centre(cell.map(p => ({ t: 0, lat: p.lat, lon: p.lng })))!;
    if ([...taken, ...out].some(t => arc(c, [t.view.lat, t.view.lon]) < cw * 1.5)) continue;
    const city = name(viewBox(c[0], c[1], zoom));
    if (city) out.push({ label: `Around ${city}`, view: { lat: +c[0].toFixed(2), lon: +c[1].toFixed(2), zoom } });
  }
  return out;
}

export async function liveFacts(base: string, page: LayerPage, spots: Spot[], { busiest = 0 } = {}): Promise<LiveFacts> {
  const points = spots.length ? await feedPoints(base, page) : undefined;
  const extra = points && busiest ? busiestViews(points, spots, spots[0].view.zoom, busiest) : [];
  const out: LiveFacts = {
    line: null, spots: {},
    inView: points && Object.fromEntries([...spots, ...extra].map(s => [s.label, countIn(points, s)])),
    ...(extra.length ? { busiest: extra } : {}),
  };
  // Outages read two routes; tours don't tell them.
  if (!page.live || !Object.hasOwn(ROUTES, page.live)) return out;
  const live = page.live as keyof typeof ROUTES;
  let json: unknown = null;
  for (let attempt = 0; attempt < 3 && !json; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 5000 * attempt));
    json = await fetch(base + ROUTES[live], { signal: AbortSignal.timeout(90_000) }).then(r => (r.ok ? r.json() : null), () => null);
  }
  if (!json) return { ...out, failed: true };
  const now = Date.now();
  const line = { earthquakes: quakeLine, launches: launchLine, aurora: auroraLine, iss: issLine }[live](json, now, en);
  out.line = line ? words(line.text) : null;
  if (page.live === 'earthquakes') {
    const day = ((json as { earthquakes?: Quake[] }).earthquakes ?? []).filter(q => q.time >= now - 86_400_000);
    // the live line names the day's strongest; quakeLine picks it the same way
    const top = day.filter(q => Number.isFinite(q.magnitude)).reduce<Quake | null>((a, b) => (!a || b.magnitude > a.magnitude ? b : a), null);
    if (top) out.focus = { lat: top.lat, lon: top.lng };
    for (const s of spots) {
      const box = viewBox(s.view.lat, s.view.lon, s.view.zoom);
      const here = day.filter(q => inBox(box, q.lat, q.lng));
      if (!here.length) continue;
      // the spot opens this quake's popup (feature.ts PICKS: the strongest of the last day in view), so the line can name it
      const top = here.reduce((a, b) => (b.magnitude > a.magnitude ? b : a));
      out.spots[s.label] = `${here.length} in the last 24 hours, counting every quake of magnitude 2.5 or more; the strongest, shown on screen, M${top.magnitude.toFixed(1)}, ${top.place}`;
    }
  }
  return out;
}

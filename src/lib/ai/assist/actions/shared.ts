/** What every tool needs: argument checks, places, waiting for data, rows for the model, feed words. */
import { feedMarks } from '@/lib/core/feed-log';
import { FIND_LAYERS, SOURCES, loaded, type Entity, type FindLayer, type Row } from '../catalog';
import { feedState, feedWords, worst, type FeedReading } from '../feed-state';
import type { Place, Point } from '../query/geo';
import type { ToolName } from '../tool-defs';
import type { Card, Lookup, Outcome, Site } from '../tools';

export const ok = (tool: ToolName, summary: string, data?: unknown, card?: Card, effects?: Outcome['effects']): Outcome =>
  ({ result: { tool, ok: true, summary, ...(data !== undefined ? { data } : {}) }, card, ...(effects ? { effects } : {}) });
export const fail = (tool: ToolName, summary: string, data?: unknown): Outcome => ({ result: { tool, ok: false, summary, ...(data !== undefined ? { data } : {}) } });

export const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '');
export const numIn = (v: unknown, lo: number, hi: number): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};
export const point = (v: unknown): Point | null => {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const lat = numIn(r.lat, -90, 90), lng = numIn(r.lng ?? r.lon, -180, 180);
  return lat !== null && lng !== null ? { lat, lng } : null;
};
export const strings = (v: unknown): string[] => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []).map(x => str(x, 60).toLowerCase()).filter(Boolean);
export const given = (v: unknown) => v !== undefined && v !== null && v !== '';
export const isSite = (lk: Lookup): lk is Site => typeof (lk as Site).setLayers === 'function';

/** How close to come for a kind of place the geocoder found. */
export function zoomFor(kind = ''): number {
  const k = kind.toLowerCase();
  if (/country/.test(k)) return 4;
  if (/state|region|province|continent|sea|ocean/.test(k)) return 5.5;
  if (/strait|bay|gulf|island|archipelago|county|district/.test(k)) return 7;
  if (/city|town|capital|municipality/.test(k)) return 9.5;
  if (/village|suburb|neighbourhood|quarter/.test(k)) return 12;
  if (/street|road|building|house|airport|aerodrome|station|stadium|tower|monument|attraction|port/.test(k)) return 14;
  return 9;
}

/** Layer names a model is likely to use, mapped to the catalogue's. */
const LAYER_ALIASES: Record<string, FindLayer> = {
  flight: 'flights', planes: 'flights', aircraft: 'flights', airliners: 'flights', jets: 'flights', private: 'flights',
  military: 'military_flights', military_aircraft: 'military_flights', mil: 'military_flights',
  ship: 'ships', vessels: 'ships', boats: 'ships', maritime: 'ships', port: 'ports', chokepoint: 'chokepoints',
  quake: 'earthquakes', quakes: 'earthquakes', earthquake: 'earthquakes', seismic: 'earthquakes',
  headlines: 'news', reports: 'news', osint: 'news', alerts: 'news',
  incident: 'incidents', disasters: 'incidents', gdacs: 'incidents', storms: 'weather', hazards: 'weather', warnings: 'weather',
  fire: 'fires', wildfires: 'fires', wildfire_incidents: 'fire_incidents', cwfis: 'fire_incidents', evacuations: 'weather',
  radioactivity: 'radiation', nuclear_radiation: 'radiation', sirens: 'air_raid_alerts', air_raid: 'air_raid_alerts', war_alerts: 'air_raid_alerts', rockets: 'air_raid_alerts',
  camera: 'cameras', cctv: 'cameras', webcams: 'cameras', satellite: 'satellites', sats: 'satellites',
  perimeters: 'fire_perimeters', fire_perimeter: 'fire_perimeters', wildfire_perimeters: 'fire_perimeters', burn_areas: 'fire_perimeters',
  launch: 'launches', rockets_launches: 'launches', power_plants: 'infrastructure', nuclear_plants: 'infrastructure', nuclear: 'infrastructure',
};

export function findLayer(v: unknown): FindLayer | null {
  const s = str(v, 40).toLowerCase().replace(/[\s-]+/g, '_');
  if ((FIND_LAYERS as string[]).includes(s)) return s as FindLayer;
  return LAYER_ALIASES[s] ?? null;
}

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason ?? new Error('aborted')); }, { once: true });
  });
}

/** What tools fetched for themselves, for layers the page keeps out of its data, kept for the conversation. */
const extras = new WeakMap<object, { data: Record<string, unknown>; at: Record<string, number> }>();
const OWN_TTL_MS = 30 * 60_000;

/** The live data, with what a tool fetched for itself. */
export function dataOf(lk: Lookup): Record<string, unknown> {
  const x = extras.get(lk.memo ?? lk);
  return x ? { ...lk.data(), ...x.data } : lk.data();
}

/** Makes a layer's data available: switched on and waited for in the page, fetched on the server. */
export async function ensure(lk: Lookup, layer: FindLayer, signal?: AbortSignal, ms = 12_000): Promise<boolean> {
  if (lk.ensure) return lk.ensure(layer, signal);
  const src = SOURCES[layer];
  if (src.own && src.feed) {
    const key = lk.memo ?? lk;
    const x = extras.get(key) ?? { data: {}, at: {} };
    if (loaded(dataOf(lk), layer) && Date.now() - (x.at[layer] ?? 0) < OWN_TTL_MS) return true;
    const body = await getJson<Row>(lk, src.feed.url, signal).catch(() => null);
    if (!body) return loaded(dataOf(lk), layer);
    extras.set(key, { data: { ...x.data, ...(src.feed.pick ? src.feed.pick(body) : body) }, at: { ...x.at, [layer]: Date.now() } });
    return loaded(dataOf(lk), layer);
  }
  if (isSite(lk)) {
    const off = SOURCES[layer].layers.filter(k => !lk.layers()[k]);
    if (off.length) lk.setLayers(off, []);
  }
  const until = Date.now() + ms;
  while (!loaded(lk.data(), layer)) {
    if (Date.now() > until) return false;
    await sleep(250, signal);
  }
  return true;
}

/** A place from a name or coordinates. */
export async function placeOf(lk: Lookup, v: unknown): Promise<Place | null> {
  const p = point(v);
  if (p) return { name: `${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}`, ...p };
  const name = typeof v === 'string' ? str(v, 120) : v && typeof v === 'object' ? str((v as Record<string, unknown>).place ?? (v as Record<string, unknown>).name, 120) : '';
  return name ? lk.geocode(name) : null;
}

/** JSON from TAKIP's own API, or null for a 404; throws on any other failure. */
export async function getJson<T = Record<string, unknown>>(lk: Lookup, path: string, signal?: AbortSignal): Promise<T | null> {
  if (lk.get) return lk.get(path, signal) as Promise<T | null>;
  const res = await fetch(path, { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** A form POST answering JSON; throws when it fails. */
export async function postForm<T = Record<string, unknown>>(lk: Lookup, url: string, form: string, signal?: AbortSignal): Promise<T> {
  if (lk.post) return lk.post(url, form, signal) as Promise<T>;
  const res = await fetch(url, { method: 'POST', body: form, signal, headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Why TAKIP's own API refused, in words for the model to pass on. */
export const refusedWhy = (err: unknown, what: string) => (/HTTP 40[13]/.test(err instanceof Error ? err.message : '')
  ? `${what} needs a TAKIP account or API key on this server: sign in, or connect with an API key`
  : `${what} did not answer`);

export const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

/** One entity as the model reads it: always with its id, so it can say which one next. */
export const row = (e: Entity & { km?: number }) => ({
  id: e.id,
  name: e.title,
  ...(e.detail ? { detail: e.detail } : {}),
  ...(e.lat !== null && e.lng !== null ? { lat: round(e.lat), lng: round(e.lng) } : {}),
  ...(e.km !== undefined ? { km: e.km } : {}),
  ...(e.time ? { when: new Date(e.time).toISOString().slice(0, 16).replace('T', ' ') } : {}),
});

export const fmt = (n: number) => (Math.abs(n) >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) < 10 ? 3 : 2 }));

export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Where the queried layers' feeds stand, worst first. */
export function feedOf(lk: Lookup, layers: FindLayer[]): FeedReading {
  const marks = lk.feeds?.() ?? feedMarks();
  const layersOn = isSite(lk) ? lk.layers() : lk.layersOn?.() ?? {};
  return worst(layers.map(l => feedState(l, { data: dataOf(lk), layersOn, marks })));
}

/** ", stale, 25 min old" to append to a summary, or nothing when the feed is live. */
export const feedTail = (r: FeedReading) => (feedWords(r) ? ` (feed ${feedWords(r)})` : '');

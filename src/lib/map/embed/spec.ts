import { DEFAULT_LAYERS, type ActiveLayers } from '@/lib/map/layers/defaults';
import type { ViewModeLink } from '@/lib/map/view-mode-link';
import { WINDOWED_LAYERS } from './windows';

/** Where an embed's camera opens. */
export interface EmbedView { lat: number; lon: number; zoom: number }

/** West, south, east, north in degrees; west above east crosses the antimeridian. */
export type Bbox = readonly [number, number, number, number];

/** A stretch of the past: the last `n` days or years, or fixed dates (epoch ms, `to` exclusive). */
export type EmbedWindow = { last: { n: number; unit: 'd' | 'y' } } | { from: number; to: number };

/**
 * What an embed shows: layers at a view or over an area, following something, or over a past window.
 * Every producer (a layer page, a place-and-period page, a hand-written link) writes this one shape,
 * and the query that carries it keeps the map's own link names (layers, lat, lon, zoom, track).
 */
export interface EmbedSpec {
  layers: string[];
  view?: EmbedView;
  /** The camera fits it, and windowed layers ask for what happened inside it. */
  bbox?: Bbox;
  /** `satellite:25544`, as the map's links carry it. */
  track?: string;
  /** Turn to the visitor at this zoom once their place is known; `view` holds until then, or if it isn't. */
  near?: number;
  /** The place the frame is about, marked on the map: `pin=lat,lon&pinname=Dalmine`. */
  pin?: { lat: number; lon: number; name?: string };
  window?: EmbedWindow;
  /** Earthquakes from this magnitude up. */
  minMag?: number;
}

/** The display layers drawn under every embed's own: day and night, and the sky. */
export const EMBED_BASE = ['day_night', 'sky_stars'] as const;
/** Day and night is today's; under a past window only the sky stays. */
const WINDOW_BASE = ['sky_stars'] as const;

const KNOWN = new Set(Object.keys(DEFAULT_LAYERS));
const MAX_LAYERS = 12;
const DAY_MS = 86_400_000;
const TRACK = /^(aircraft|ship|satellite):[\w-]{1,40}$/i;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function num(v: string | null, min: number, max: number): number | null {
  if (v === null || !/^-?\d{1,4}(\.\d{1,8})?$/.test(v.trim())) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
}

/** `2016` or `2016-10-19`, as UTC midnight. */
function day(v: string | null): number | null {
  const m = /^(\d{4})(?:-(\d{2})-(\d{2}))?$/.exec(v?.trim() ?? '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), m[2] ? Number(m[2]) : 1, m[3] ? Number(m[3]) : 1];
  const t = Date.UTC(y, mo - 1, d);
  return new Date(t).getUTCDate() === d && y >= 1000 ? t : null;
}

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

function parseWindow(p: URLSearchParams, now: number): EmbedWindow | undefined {
  const last = /^(\d{1,4})([dy])$/.exec(p.get('last')?.trim() ?? '');
  if (last) {
    const n = Number(last[1]);
    const unit = last[2] as 'd' | 'y';
    return n >= 1 && n <= (unit === 'y' ? 500 : 3650) ? { last: { n, unit } } : undefined;
  }
  const from = day(p.get('from'));
  if (from === null) return undefined;
  const to = p.has('to') ? day(p.get('to')) : Math.floor(now / DAY_MS) * DAY_MS + DAY_MS;
  return to !== null && from < to && from <= now ? { from, to } : undefined;
}

/** A spec from a query; anything malformed is left out rather than refused. */
export function parseEmbedSpec(p: URLSearchParams, now = Date.now()): EmbedSpec {
  const spec: EmbedSpec = {
    layers: [...new Set((p.get('layers') ?? '').split(',').map(k => k.trim()).filter(k => KNOWN.has(k)))].slice(0, MAX_LAYERS),
  };
  const lat = num(p.get('lat'), -85, 85);
  const lon = num(p.get('lon'), -180, 180);
  if (lat !== null && lon !== null) spec.view = { lat, lon, zoom: num(p.get('zoom'), 1.5, 18) ?? 3 };
  const b = (p.get('bbox') ?? '').split(',').map(v => num(v, -180, 180));
  if (b.length === 4 && b.every(v => v !== null)) {
    const [w, s, e, n] = b as number[];
    if (Math.abs(s) <= 90 && Math.abs(n) <= 90 && s < n && w !== e) spec.bbox = [w, s, e, n];
  }
  const track = p.get('track')?.trim();
  if (track && TRACK.test(track)) spec.track = track;
  const near = num(p.get('near'), 1.5, 18);
  if (near !== null) spec.near = near;
  const at = (p.get('pin') ?? '').split(',');
  const pinLat = num(at[0], -85, 85);
  const pinLon = num(at[1] ?? null, -180, 180);
  if (at.length === 2 && pinLat !== null && pinLon !== null) {
    const name = p.get('pinname')?.replace(/\p{C}/gu, '').trim().slice(0, 60);
    spec.pin = { lat: pinLat, lon: pinLon, ...(name ? { name } : {}) };
  }
  const window = parseWindow(p, now);
  if (window) spec.window = window;
  const minMag = num(p.get('minmag'), 0, 9.9);
  if (minMag !== null) spec.minMag = Math.round(minMag * 10) / 10;
  return spec;
}

/** The query that carries `spec`; parseEmbedSpec reads it back. */
export function embedQuery(spec: EmbedSpec): string {
  const p = new URLSearchParams();
  if (spec.layers.length) p.set('layers', spec.layers.join(','));
  if (spec.view) {
    p.set('lat', spec.view.lat.toFixed(4));
    p.set('lon', spec.view.lon.toFixed(4));
    p.set('zoom', spec.view.zoom.toFixed(2));
  }
  if (spec.bbox) p.set('bbox', spec.bbox.map(v => +v.toFixed(4)).join(','));
  if (spec.track) p.set('track', spec.track);
  if (spec.near !== undefined) p.set('near', String(spec.near));
  if (spec.pin) {
    p.set('pin', `${spec.pin.lat.toFixed(4)},${spec.pin.lon.toFixed(4)}`);
    if (spec.pin.name) p.set('pinname', spec.pin.name);
  }
  if (spec.window && 'last' in spec.window) p.set('last', `${spec.window.last.n}${spec.window.last.unit}`);
  else if (spec.window) {
    p.set('from', isoDay(spec.window.from));
    p.set('to', isoDay(spec.window.to));
  }
  if (spec.minMag !== undefined) p.set('minmag', String(spec.minMag));
  return p.toString().replace(/%2C/g, ',').replace(/%3A/g, ':');
}

export const embedHref = (spec: EmbedSpec) => {
  const q = embedQuery(spec);
  return q ? `/embed?${q}` : '/embed';
};

/**
 * The window as epoch ms. A relative one ends at the close of today (UTC), so everyone who opens
 * "the last 10 years" on the same day asks for the same stretch.
 */
export function resolveWindow(w: EmbedWindow, now = Date.now()): { from: number; to: number } {
  if (!('last' in w)) return w;
  const to = Math.floor(now / DAY_MS) * DAY_MS + DAY_MS;
  if (w.last.unit === 'd') return { from: to - w.last.n * DAY_MS, to };
  const from = new Date(to);
  from.setUTCFullYear(from.getUTCFullYear() - w.last.n);
  return { from: from.getTime(), to };
}

/**
 * The map's layer set for `spec`: its layers over the base ones, everything else off. Under a past
 * window only layers that can show one stay, so nothing live sits under a caption about the past.
 */
export function embedLayers(spec: Pick<EmbedSpec, 'layers' | 'window'>): ActiveLayers {
  const own = spec.window ? spec.layers.filter(k => WINDOWED_LAYERS.has(k)) : spec.layers;
  const on = new Set<string>([...(spec.window ? WINDOW_BASE : EMBED_BASE), ...own]);
  // A spec naming no vessel filter keeps their defaults, as the map's links do (use-startup.ts).
  const setsShips = own.some(k => k.startsWith('ships_'));
  const layers = Object.fromEntries(Object.entries(DEFAULT_LAYERS).map(([k, v]) => [k, k.startsWith('ships_') && !setsShips ? v : on.has(k)])) as ActiveLayers;
  // The map draws conflict zones unless this key is false, and no layer key switches them on.
  return Object.assign(layers, { conflict_zones: false });
}

/** Where "Open the full map" takes a windowed spec: History over the same years, with its layers' families on. */
export function historyLink(spec: Pick<EmbedSpec, 'layers' | 'window'>, now = Date.now()): ViewModeLink | undefined {
  if (!spec.window) return undefined;
  const { from, to } = resolveWindow(spec.window, now);
  const year = (t: number) => new Date(t).getUTCFullYear();
  const families = [...new Set(spec.layers.flatMap(k => WINDOWED_LAYERS.get(k)?.family ?? []))];
  const range = { from: year(from), to: Math.min(year(to - 1), year(now)) };
  return { view: 'history', year: range.from, layer: null, range, ...(families.length ? { families } : {}) };
}

/** A view that roughly fits `bbox` in a 1024 px wide map, for links into the full map, which takes a centre and zoom. */
export function bboxView([w, s, e, n]: Bbox): EmbedView {
  const span = w < e ? e - w : e - w + 360;
  const lon = ((w + span / 2 + 540) % 360) - 180;
  const zoom = Math.log2(Math.min(720 / span, 340 / Math.max(n - s, 0.01)));
  return { lat: (s + n) / 2, lon, zoom: +clamp(zoom, 1.5, 14).toFixed(2) };
}

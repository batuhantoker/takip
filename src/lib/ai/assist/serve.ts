/**
 * TAKIP AI Assist on the server: the data tools for MCP clients, over the same feeds the page reads.
 * The Lookup here fetches each layer from TAKIP's own routes (relative to the site's origin) and
 * maps it onto the page's data keys, so ./actions run unchanged and need no model key.
 */
import { TAKIP_UA as UA } from '@/lib/core/net/http-json';
import type { FeedMark } from '@/lib/core/feed-log';
import { parseBoundaries, type Boundary } from '@/lib/places/areas/boundaries';
import { SOURCES, type FindLayer, type Row } from './catalog';
import { aircraft } from './actions/aircraft';
import { brief } from './actions/brief';
import { chronicle, pastEvent } from './actions/history';
import { link } from './actions/navigate';
import { nearby } from './actions/nearby';
import { route } from './actions/route';
import { find, scanArea } from './actions/search';
import { pass } from './actions/sky';
import { weather } from './actions/weather';
import type { Place } from './query/geo';
import type { ToolName } from './tool-defs';
import type { Lookup, Outcome } from './tools';

type Serve = (args: Record<string, unknown>, lk: Lookup, signal?: AbortSignal) => Promise<Outcome>;

export const SERVE: Partial<Record<ToolName, Serve>> = { find, scan: scanArea, aircraft, weather, pass, brief, route, nearby, link, chronicle, past_event: pastEvent };

const PHOTON = 'https://photon.komoot.io/api';

async function json(url: string, signal?: AbortSignal, timeoutMs = 20_000, headers: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) });
  return { status: res.status, body: res.ok ? await res.json() : null };
}

/** A Lookup over TAKIP's own routes, for one MCP call. */
export function serverLookup(origin: string, signal?: AbortSignal, authorization?: string): Lookup {
  const base = origin.replace(/\/+$/, '');
  let data: Record<string, unknown> = {};
  const marks: Record<string, FeedMark> = {};
  const inflight = new Map<string, Promise<boolean>>();
  const abs = (path: string) => (/^https:\/\//.test(path) ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`);
  // Only TAKIP's own keyed routes see the caller's key; third-party services never do.
  const keyFor = (url: string): Record<string, string> => (authorization && url.startsWith(`${base}/api/`) ? { Authorization: authorization } : {});

  const load = (url: string, pick?: (b: Row) => Row): Promise<boolean> => {
    const key = url.split('?')[0];
    let p = inflight.get(key);
    if (!p) {
      p = json(abs(url), signal).then(({ status, body }) => {
        if (!body || typeof body !== 'object') {
          marks[key] = { at: null, failedAt: Date.now(), error: `HTTP ${status}`, keys: [] };
          return false;
        }
        const b = body as Row;
        const d = pick ? pick(b) : b;
        data = { ...data, ...d };
        marks[key] = { at: Date.now(), failedAt: null, keys: Object.keys(d), source: typeof b.source === 'string' ? b.source : undefined, error: typeof b.error === 'string' ? b.error : undefined };
        return true;
      }).catch(err => {
        marks[key] = { at: null, failedAt: Date.now(), error: err instanceof Error ? err.message : 'failed', keys: [] };
        return false;
      });
      inflight.set(key, p);
    }
    return p;
  };

  let countries: Promise<Boundary[]> | null = null;
  const admin1 = new Map<string, Promise<Boundary[]>>();

  return {
    data: () => data,
    origin: base,
    feeds: () => marks,
    layersOn: () => ({}),
    memo: {},
    async ensure(layer: FindLayer) {
      const feed = SOURCES[layer].feed;
      if (!feed) return false;
      await load(feed.url, feed.pick);
      return SOURCES[layer].keys.some(k => Array.isArray(data[k]));
    },
    async get(path, sig) {
      const { status, body } = await json(abs(path), sig ?? signal, 20_000, keyFor(abs(path)));
      if (status === 404) return null;
      if (body === null) throw new Error(`HTTP ${status}`);
      return body;
    },
    async post(url, form, sig) {
      // Overpass turns away clients that do not say who they are.
      const res = await fetch(url, { method: 'POST', body: form, headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.any([sig ?? signal, AbortSignal.timeout(35_000)].filter((s): s is AbortSignal => Boolean(s))) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    async geocode(q): Promise<Place | null> {
      const own = await json(`${base}/api/v1/geo/search?q=${encodeURIComponent(q)}`, signal, 8000, keyFor(`${base}/api/v1/`)).catch(() => null);
      const hit = (own?.body as { results?: { name: string; lat: number; lng: number; kind?: string }[] } | null)?.results?.[0];
      if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng)) return { name: hit.name, lat: hit.lat, lng: hit.lng, kind: hit.kind };
      // The accounts API may not be running; Photon answers keylessly.
      const ph = await json(`${PHOTON}?q=${encodeURIComponent(q)}&limit=1&lang=en`, signal, 8000).catch(() => null);
      const f = (ph?.body as { features?: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] } | null)?.features?.[0];
      if (!f) return null;
      const p = f.properties;
      return { name: [p.name, p.state, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '), lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], kind: p.osm_value === 'country' ? 'country' : p.type || p.osm_value };
    },
    regions: {
      countries: () => (countries ??= json(`${base}/data/boundaries/countries.json`, signal).then(r => parseBoundaries(r.body as { features?: GeoJSON.Feature[] }, 'country'))),
      admin1: id => {
        let p = admin1.get(id);
        if (!p) {
          p = json(`${base}/data/boundaries/admin1/${encodeURIComponent(id)}.json`, signal).then(r => (r.body ? parseBoundaries(r.body as { features?: GeoJSON.Feature[] }, 'admin1') : []));
          admin1.set(id, p);
        }
        return p;
      },
    },
  };
}

export async function serveTool(name: ToolName, args: Record<string, unknown>, lk: Lookup, signal?: AbortSignal): Promise<Outcome | null> {
  const run = SERVE[name];
  return run ? run(args, lk, signal) : null;
}

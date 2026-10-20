import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/core/net/source-cache';
import { getClientIp, isRateLimited } from '@/lib/core/net/ssrf-guard';
import { parseEmbedSpec, resolveWindow, type Bbox } from '@/lib/map/embed/spec';
import { WINDOWED_LAYERS } from '@/lib/map/embed/windows';
import { mapUsgsQuake, parseFeatures, type Quake, type UsgsFeature } from '../catalog';
import { archivedRange } from './archive';
import { defaultMinMag } from './floor';

/**
 * Earthquakes over a past window, for the embed: ?last=10y or ?from=1926&to=2026-10-20, with
 * &bbox=w,s,e,n and &minmag= (the embed's own grammar, lib/map/embed/spec.ts).
 * USGS ComCat (US public domain) returns at most 20,000 events a query, so this asks for the
 * LIMIT largest and the count, and the embed says how many it shows of how many. A worldwide
 * window takes USGS 10–30 s at any floor (2026-10-19), so it is cached, and the count may give up. A window
 * data/site/earthquakes.json holds whole, as every place page's does, is answered from it instead.
 */

const FDSN = 'https://earthquake.usgs.gov/fdsnws/event/1';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const LIMIT = 2000;
const QUERY_TIMEOUT_MS = 45_000;
const COUNT_TIMEOUT_MS = 20_000;
/** A window that reaches today picks up new quakes, a short one sooner; a closed one changes only by review. */
const ttlFor = (from: number, to: number) =>
  to <= Date.now() ? 24 * 3600_000 : to - from <= 31 * 86_400_000 ? 15 * 60_000 : 3600_000;

interface Payload {
  earthquakes: Quake[];
  /** All the quakes in the window, of which `earthquakes` holds the largest; null when the count failed. */
  total: number | null;
  /** The most `earthquakes` holds: a full list with no total is the largest of an unknown number. */
  limit: number;
  from: number;
  to: number;
  minMag: number;
}

function fdsnQuery(from: number, to: number, minMag: number, bbox?: Bbox): string {
  const p = new URLSearchParams({
    format: 'geojson',
    starttime: new Date(from).toISOString().slice(0, 19),
    endtime: new Date(to).toISOString().slice(0, 19),
    minmagnitude: String(minMag),
  });
  if (bbox) {
    const [w, s, e, n] = bbox;
    // Across the antimeridian USGS takes the east edge past 180.
    p.set('minlatitude', String(s));
    p.set('maxlatitude', String(n));
    p.set('minlongitude', String(w));
    p.set('maxlongitude', String(w > e ? e + 360 : e));
  }
  return p.toString();
}

async function getJson(url: string, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from USGS`);
  return res.json();
}

function loader(from: number, to: number, minMag: number, bbox: Bbox | undefined) {
  const q = fdsnQuery(from, to, minMag, bbox);
  return cachedSource<Payload>(`earthquakes:range:${q}`, async () => {
    const [rows, count] = await Promise.allSettled([
      getJson(`${FDSN}/query?${q}&orderby=magnitude&limit=${LIMIT}`, QUERY_TIMEOUT_MS),
      // Over the limit the count still comes back, beside an error saying so.
      getJson(`${FDSN}/count?${q}`, COUNT_TIMEOUT_MS),
    ]);
    if (rows.status === 'rejected') throw rows.reason;
    const earthquakes = parseFeatures<UsgsFeature>(rows.value, 'USGS').map(mapUsgsQuake).filter((e): e is Quake => e !== null)
      // Older catalogue entries carry raw floats (4.92255584370382); the live feed's are already rounded.
      .map(e => ({ ...e, magnitude: Math.round(e.magnitude * 100) / 100 }));
    const counted = count.status === 'fulfilled' ? (count.value as { count?: unknown } | null)?.count : null;
    return [{ earthquakes, total: typeof counted === 'number' ? Math.max(counted, earthquakes.length) : null, limit: LIMIT, from, to, minMag }];
  }, ttlFor(from, to));
}

export async function GET(req: Request) {
  if (isRateLimited(`quake-range:${getClientIp(req)}`, 20)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const spec = parseEmbedSpec(new URL(req.url).searchParams);
  if (!spec.window) return NextResponse.json({ error: 'A window is required: last=10y, or from= (and to=) as YYYY or YYYY-MM-DD' }, { status: 400 });
  const window = resolveWindow(spec.window);
  const from = Math.max(window.from, WINDOWED_LAYERS.get('earthquakes')!.since);
  const to = Math.min(window.to, Date.now() + 86_400_000);
  if (from >= to) return NextResponse.json({ error: 'The window is before the catalogue starts' }, { status: 400 });
  const minMag = spec.minMag ?? defaultMinMag(spec.bbox, from, to);
  try {
    const local = archivedRange(from, to, minMag, spec.bbox, LIMIT);
    const [payload] = local ? [{ ...local, limit: LIMIT, from, to, minMag }] : await loader(from, to, minMag, spec.bbox)();
    if (!payload) throw new Error('no earthquake data');
    const ttl = Math.round(ttlFor(from, to) / 1000);
    return NextResponse.json({ ...payload, source: 'USGS' }, {
      headers: { 'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl}` },
    });
  } catch (error) {
    console.error('Earthquake range fetch error:', error);
    return NextResponse.json({ earthquakes: [], error: 'Failed to fetch earthquake data' }, { status: 502 });
  }
}

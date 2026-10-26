import { NextResponse, type NextRequest } from 'next/server';
import { forecastPoint, MET_FORECAST_URL, parseMetForecast, type Forecast } from '@/lib/feeds/weather/forecast';

/**
 * TAKIP — a point forecast, `?lat=&lon=` and optionally `&altitude=` in whole metres (a summit's: MET otherwise uses
 * its model's ground there), from MET Norway's Locationforecast (lib/feeds/weather/forecast.ts).
 * MET's terms: identify ourselves, keep each answer until its Expires, revalidate with If-Modified-Since, and
 * stay well under 20 requests a second.
 */

export const dynamic = 'force-dynamic';

const UA = 'TAKIP/0.1 (+https://takip.dev)';
const MAX_HELD = 3000;
const RETRY_MS = 10 * 60_000;
/** Upstream requests a second, shared by every caller. */
const PER_SECOND = 5;

interface Held { forecast: Forecast | null; expires: number; modified: string | null }

const state = (globalThis as unknown as { metForecast?: { held: Map<string, Held>; inflight: Map<string, Promise<Held>>; second: number; used: number } })
  .metForecast ??= { held: new Map(), inflight: new Map(), second: 0, used: 0 };

function allowUpstream(): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (now !== state.second) { state.second = now; state.used = 0; }
  return ++state.used <= PER_SECOND;
}

async function fetchPoint(lat: number, lon: number, altitude: number | null, prior: Held | undefined): Promise<Held> {
  const res = await fetch(`${MET_FORECAST_URL}?lat=${lat}&lon=${lon}${altitude === null ? '' : `&altitude=${altitude}`}`, {
    headers: { 'User-Agent': UA, ...(prior?.modified ? { 'If-Modified-Since': prior.modified } : {}) },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  const expires = Date.parse(res.headers.get('expires') ?? '') || Date.now() + 30 * 60_000;
  if (res.status === 304 && prior) return { ...prior, expires };
  if (!res.ok) throw new Error(`MET Norway answered ${res.status}`);
  return { forecast: parseMetForecast(await res.json()), expires, modified: res.headers.get('last-modified') };
}

async function forecastAt(lat: number, lon: number, altitude: number | null): Promise<Forecast | null> {
  const key = `${lat},${lon},${altitude ?? ''}`;
  const prior = state.held.get(key);
  if (prior && Date.now() < prior.expires) return prior.forecast;
  const running = state.inflight.get(key);
  if (running) return (await running).forecast;
  if (!allowUpstream()) return prior?.forecast ?? null;
  const next = fetchPoint(lat, lon, altitude, prior)
    .catch(() => ({ forecast: prior?.forecast ?? null, expires: Date.now() + RETRY_MS, modified: prior?.modified ?? null }))
    .finally(() => state.inflight.delete(key));
  state.inflight.set(key, next);
  const held = await next;
  // Map order is insertion order, so re-inserting keeps the oldest first for eviction.
  state.held.delete(key);
  state.held.set(key, held);
  if (state.held.size > MAX_HELD) state.held.delete(state.held.keys().next().value!);
  return held.forecast;
}

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lon = Number(req.nextUrl.searchParams.get('lon'));
  if (!req.nextUrl.searchParams.has('lat') || !req.nextUrl.searchParams.has('lon') || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
  }
  const alt = Math.round(Number(req.nextUrl.searchParams.get('altitude')));
  const altitude = req.nextUrl.searchParams.has('altitude') && alt >= -500 && alt <= 9000 ? alt : null;
  const p = forecastPoint(lat, lon);
  const forecast = await forecastAt(p.lat, p.lon, altitude);
  if (!forecast?.steps.length) return NextResponse.json({ error: 'forecast unavailable' }, { status: 503 });
  return NextResponse.json({ ...forecast, source: 'MET Norway', licence: 'CC BY 4.0' }, {
    headers: { 'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600' },
  });
}

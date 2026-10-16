import { NextResponse } from 'next/server';
import { gzipSync } from 'node:zlib';
import { encodeWind } from '@/lib/feeds/weather/wind-field';
import { fetchGfsWind } from '../gfs';

/**
 * TAKIP — the wind layer's field: GFS 10 m wind at 0.5° (see ../gfs), in lib/feeds/weather/wind-field's
 * wire format, gzipped. Read again once the next 3-hour step is nearer than the one held.
 */

export const maxDuration = 60;

const RETRY_MS = 10 * 60_000;
const HALF_STEP_MS = 90 * 60_000;
/** Past this the forecast is too old to pass for now, and the client draws the Open-Meteo arrows instead. */
const STALE_MS = 6 * 3600_000;

interface Held { body: Uint8Array<ArrayBuffer>; time: number }

const globalForWind = globalThis as unknown as {
  windField?: { held: Held | null; nextFetch: number; inflight: Promise<Held | null> | null };
};

async function loadWind(): Promise<Held | null> {
  const state = (globalForWind.windField ??= { held: null, nextFetch: 0, inflight: null });
  if (Date.now() < state.nextFetch) return state.held;
  if (state.inflight) return state.inflight;

  state.inflight = fetchGfsWind()
    .then(field => {
      const held = { body: new Uint8Array(gzipSync(encodeWind(field))), time: Date.parse(field.time) };
      state.held = held;
      state.nextFetch = Math.max(held.time + HALF_STEP_MS, Date.now() + RETRY_MS);
      return held;
    })
    .catch(err => {
      console.warn('[TAKIP] GFS wind refresh failed:', err instanceof Error ? err.message : err);
      state.nextFetch = Date.now() + RETRY_MS;
      return state.held;
    })
    .finally(() => { state.inflight = null; });
  return state.inflight;
}

export async function GET() {
  const held = await loadWind();
  if (!held || Date.now() - held.time > STALE_MS) {
    return NextResponse.json({ error: 'Wind field unavailable' }, { status: 503 });
  }
  return new NextResponse(held.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'gzip',
      'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=1800',
    },
  });
}

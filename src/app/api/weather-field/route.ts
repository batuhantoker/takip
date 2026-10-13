import { NextResponse } from 'next/server';
import { gzipSync } from 'node:zlib';
import { encodeField } from '@/lib/weather/weather-field';
import { fetchGfsTemperature } from './gfs';

/**
 * TAKIP — the temperature layer's field: GFS 2 m temperature at 0.25° (see
 * ./gfs), in lib/weather/weather-field's wire format, gzipped to ~550 KB. Read again
 * once the next 3-hour step is nearer than the one held.
 */

export const maxDuration = 60;

const RETRY_MS = 10 * 60_000;
const HALF_STEP_MS = 90 * 60_000;
/** Past this the field is too old to pass for now, and the client paints the Open-Meteo grid instead. */
const STALE_MS = 6 * 3600_000;

interface Held { body: Uint8Array<ArrayBuffer>; time: number }

const globalForField = globalThis as unknown as {
  weatherField?: { held: Held | null; nextFetch: number; inflight: Promise<Held | null> | null };
};

async function loadField(): Promise<Held | null> {
  const state = (globalForField.weatherField ??= { held: null, nextFetch: 0, inflight: null });
  if (Date.now() < state.nextFetch) return state.held;
  if (state.inflight) return state.inflight;

  state.inflight = fetchGfsTemperature()
    .then(field => {
      const held = { body: new Uint8Array(gzipSync(encodeField(field))), time: Date.parse(field.time) };
      state.held = held;
      state.nextFetch = Math.max(held.time + HALF_STEP_MS, Date.now() + RETRY_MS);
      return held;
    })
    .catch(err => {
      console.warn('[TAKIP] GFS temperature refresh failed:', err instanceof Error ? err.message : err);
      state.nextFetch = Date.now() + RETRY_MS;
      return state.held;
    })
    .finally(() => { state.inflight = null; });
  return state.inflight;
}

/** Test seam — drops the held field. */
export function clearWeatherField(): void {
  delete globalForField.weatherField;
}

export async function GET() {
  const held = await loadField();
  if (!held || Date.now() - held.time > STALE_MS) {
    return NextResponse.json({ error: 'Temperature field unavailable' }, { status: 503 });
  }
  return new NextResponse(held.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'gzip',
      'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=1800',
    },
  });
}

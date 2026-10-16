import { NextResponse } from 'next/server';
import { loadSky } from './load';

/** TAKIP — Sun, Moon and planets from JPL Horizons (see ./collect). */

export const maxDuration = 30;

export async function GET() {
  const state = await loadSky();
  if (!state) {
    return NextResponse.json({ bodies: [], error: 'JPL Horizons unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json(state.payload, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
  });
}

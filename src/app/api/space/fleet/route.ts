import { NextResponse } from 'next/server';
import { fleetSnapshot } from './collect';

/** TAKIP — every spacecraft JPL Horizons can place now (see ./collect). */

export const maxDuration = 30;

export async function GET() {
  const payload = await fleetSnapshot(8_000);
  if (!payload.craft.length && !payload.pending) {
    return NextResponse.json({ ...payload, error: 'JPL Horizons unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json(payload, {
    // A partial cold-start answer must not be cached as the fleet.
    headers: { 'Cache-Control': payload.pending ? 'no-store' : 'public, s-maxage=900, stale-while-revalidate=3600' },
  });
}

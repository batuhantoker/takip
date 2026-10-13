import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/sourceCache';
import type { OuterPayload } from '@/lib/space/outer';
import { collectOuter } from './collect';

/** TAKIP — dwarf planets, interstellar visitors and distant minor planets (see ./collect). */

export const maxDuration = 60;

// Bodies past Neptune move a fraction of a degree a month; a day-old answer is current.
const load = cachedSource<OuterPayload>('space:outer', async () => [await collectOuter()], 24 * 3_600_000);

export async function GET() {
  const [payload] = await load();
  if (!payload) return NextResponse.json({ error: 'JPL Horizons and the Minor Planet Center unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } });
}

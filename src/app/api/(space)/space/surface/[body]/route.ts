import { NextResponse } from 'next/server';
import { isGlobeWorld } from '@/lib/space/worlds';
import { loadSurface } from '../load';

/** TAKIP — orbiters over the Moon and Mars, and the Mars rovers (see ../collect). */

export const maxDuration = 30;

export async function GET(_req: Request, { params }: { params: Promise<{ body: string }> }) {
  const { body } = await params;
  if (!isGlobeWorld(body)) return NextResponse.json({ error: 'Unknown body' }, { status: 404 });
  const payload = await loadSurface(body);
  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' },
  });
}

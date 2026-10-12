import { NextResponse } from 'next/server';
import { SUN_CHANNELS, type SunFrame } from '@/lib/space/sun';
import { closestFrame } from './helioviewer';

/** TAKIP — the latest solar frame per channel, with its time (see ./helioviewer). */

export async function GET() {
  const frames: SunFrame[] = await Promise.all(SUN_CHANNELS.map(async c => ({
    key: c.key,
    frameTime: await closestFrame(c).catch(() => null),
  })));
  return NextResponse.json({ frames }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}

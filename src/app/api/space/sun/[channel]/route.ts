import { NextResponse } from 'next/server';
import { sunChannel } from '@/lib/space/sun';
import { closestFrame, frameImage } from '../helioviewer';

/** TAKIP — one solar frame as a JPEG; `?t=` is the frame time from /api/space/sun. */

export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const channel = sunChannel((await params).channel);
  if (!channel) return NextResponse.json({ error: 'Unknown channel' }, { status: 404 });
  try {
    const time = await closestFrame(channel);
    if (!time) throw new Error('no frame');
    const jpeg = await frameImage(channel, time);
    // The URL names the frame, so a matching ?t= can be cached for good.
    const pinned = new URL(req.url).searchParams.get('t') === time;
    return new NextResponse(new Uint8Array(jpeg), {
      headers: {
        'Content-Type': 'image/jpeg',
        'X-Frame-Time': time,
        'Cache-Control': pinned ? 'public, max-age=86400, immutable' : 'public, max-age=300',
      },
    });
  } catch (e) {
    console.warn(`[TAKIP] sun ${channel.key}:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Helioviewer unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}

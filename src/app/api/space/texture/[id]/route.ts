import { NextResponse } from 'next/server';
import { isTextureId } from '@/lib/space/worlds';
import { bodyTexture } from '../stitch';

/** TAKIP — a whole-globe texture for the space view (see ../stitch). `?detail=high` for 4096 px. */

export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isTextureId(id)) return NextResponse.json({ error: 'Unknown texture' }, { status: 404 });
  const detail = new URL(req.url).searchParams.get('detail') === 'high' ? 'high' : 'low';
  try {
    const jpeg = await bodyTexture(id, detail);
    return new NextResponse(new Uint8Array(jpeg), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=2592000, immutable' },
    });
  } catch (e) {
    console.warn(`[TAKIP] texture ${id}/${detail}:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'NASA imagery unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}

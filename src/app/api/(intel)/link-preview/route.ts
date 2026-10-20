import { NextResponse } from 'next/server';
import { previewKey, readLinkPreview } from '@/lib/core/link-preview/fetch';
import { getClientIp, isRateLimited } from '@/lib/core/net/ssrf-guard';

/**
 * TAKIP — the preview card of a news article: `?url=<page>` → its title,
 * description, picture URL and site name, read from the page's `<head>`.
 * The map and the Alerts panel ask for one when a GDELT story is opened, since
 * GDELT itself carries only the link.
 */

export async function GET(req: Request) {
  if (isRateLimited(`link-preview:${getClientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many previews; try again in a minute' }, { status: 429 });
  }
  const raw = new URL(req.url).searchParams.get('url') ?? '';
  if (raw.length > 2048 || !previewKey(raw)) {
    return NextResponse.json({ error: 'url must be an http(s) address' }, { status: 400 });
  }
  const preview = await readLinkPreview(raw);
  if (!preview) {
    return NextResponse.json({ error: 'No preview' }, { status: 404, headers: { 'Cache-Control': 'public, s-maxage=1200' } });
  }
  return NextResponse.json(preview, { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } });
}

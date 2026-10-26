import { assetLinks } from '@/lib/platform/native/app-links';

export const dynamic = 'force-dynamic';

export function GET() {
  const links = assetLinks(process.env.ANDROID_CERT_SHA256);
  return links ? Response.json(links, { headers: { 'Cache-Control': 'public, max-age=3600' } }) : new Response('Not found', { status: 404 });
}

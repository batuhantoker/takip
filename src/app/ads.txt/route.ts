import { AD_CLIENT, adsTxt } from '@/lib/ads';

export const dynamic = 'force-static';

export function GET() {
  if (!AD_CLIENT) return new Response('Not found\n', { status: 404 });
  return new Response(adsTxt(AD_CLIENT), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  });
}

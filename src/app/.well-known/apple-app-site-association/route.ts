import { appleAppSiteAssociation } from '@/lib/platform/native/app-links';

export const dynamic = 'force-dynamic';

export function GET() {
  const aasa = appleAppSiteAssociation(process.env.APPLE_TEAM_ID);
  return aasa ? Response.json(aasa, { headers: { 'Cache-Control': 'public, max-age=3600' } }) : new Response('Not found', { status: 404 });
}

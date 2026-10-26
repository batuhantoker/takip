import { headers } from 'next/headers';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { eventSitemapUrls } from '@/lib/platform/site/events/sitemap';
import { mountainSitemapUrls } from '@/lib/platform/site/mountains/sitemap';
import { placeSitemapUrls } from '@/lib/platform/site/places/sitemap';

// The event sitemaps are counted from data/db when asked; a build machine has none.
export const dynamic = 'force-dynamic';

/**
 * Every sitemap in one index (Next writes none for generateSitemaps), so Search Console and Bing take
 * a single submission and find new place and event chunks on their own. robots.txt lists the same files.
 */
export async function GET() {
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const entries = [`${origin}/sitemap.xml`, ...placeSitemapUrls(origin), ...eventSitemapUrls(origin), ...mountainSitemapUrls(origin)].map(loc => `  <sitemap><loc>${loc}</loc></sitemap>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</sitemapindex>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' } });
}

import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { eventSitemapUrls } from '@/lib/platform/site/events/sitemap';
import { mountainSitemapUrls } from '@/lib/platform/site/mountains/sitemap';
import { placeSitemapUrls } from '@/lib/platform/site/places/sitemap';

// The event sitemaps are counted from data/db when asked; a build machine has none.
export const dynamic = 'force-dynamic';

// /og stays crawlable: X's card fetcher obeys robots.txt before it draws a preview.
// A compare page's chart settings (?from, ?log…) multiply into endless copies of one canonical page; crawlers walked millions.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/design', '/w/', '/compare/*?', '/*/compare/*?'] },
    // The place and event pages are too many for one file; they come in chunks of their own, and the index names them all.
    sitemap: [`${origin}/sitemap-index.xml`, `${origin}/sitemap.xml`, ...placeSitemapUrls(origin), ...eventSitemapUrls(origin), ...mountainSitemapUrls(origin)],
  };
}

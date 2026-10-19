import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { placeSitemapUrls } from '@/lib/platform/site/places/sitemap';

// /og stays crawlable: X's card fetcher obeys robots.txt before it draws a preview.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/design', '/w/'] },
    // The place pages are too many for one file; they come in chunks of their own, and the index names them all.
    sitemap: [`${origin}/sitemap-index.xml`, `${origin}/sitemap.xml`, ...placeSitemapUrls(origin)],
  };
}

import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';

// /og stays crawlable: X's card fetcher obeys robots.txt before it draws a preview.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/design', '/w/'] },
    sitemap: `${origin}/sitemap.xml`,
  };
}

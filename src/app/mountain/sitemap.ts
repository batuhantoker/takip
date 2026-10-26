import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { localePath } from '@/lib/platform/site/locale-path';
import { mountainSitemapChunk, mountainSitemapIds } from '@/lib/platform/site/mountains/sitemap';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';

// The index lives in data/db, which a build machine doesn't have: read it when asked, never at build time.
export const dynamic = 'force-dynamic';

/** The indexed mountain pages, at /mountain/sitemap/<n>.xml: each page in every language (the pages name their alternates). */
export async function generateSitemaps() {
  return mountainSitemapIds();
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  return mountainSitemapChunk(Number(await id)).map(({ path, locale }) => ({
    url: `${origin}${localePath(locale, path)}`,
    changeFrequency: 'monthly',
  }));
}

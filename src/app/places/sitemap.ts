import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { localePath } from '@/lib/platform/site/locale-path';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { placeSitemapChunk, placeSitemapIds } from '@/lib/platform/site/places/sitemap';

/** The place pages, at /places/sitemap/<n>.xml: each page in every language (the pages name their alternates). */
export async function generateSitemaps() {
  return placeSitemapIds();
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  return placeSitemapChunk(Number(await id)).map(({ path, locale }) => ({
    url: `${origin}${localePath(locale, path)}`,
    changeFrequency: 'daily',
  }));
}

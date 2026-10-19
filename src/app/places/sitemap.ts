import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { placeSitemapChunk, placeSitemapIds } from '@/lib/platform/site/places/sitemap';

/** The place pages, at /places/sitemap/<n>.xml. English URLs only: each page names its other languages in its head. */
export async function generateSitemaps() {
  return placeSitemapIds();
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  return placeSitemapChunk(Number(await id)).map(path => ({ url: `${origin}${path}`, changeFrequency: 'daily' }));
}

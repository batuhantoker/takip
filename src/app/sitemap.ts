import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { LOCALES } from '@/lib/core/i18n/locales';
import { availableGuides, guidePath } from '@/lib/platform/site/guides/guides';
import { worldPath, worldSlugs } from '@/lib/platform/site/compare/world';
import { availablePages, pagePath } from '@/lib/platform/site/layer-pages';
import { liveImagePath } from '@/lib/platform/site/live-images';
import { languageAlternates, localePath } from '@/lib/platform/site/locale-path';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';

// No lastModified: stamped with the request time, it would change on every fetch and crawlers learn to ignore it.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  /** A reading page in every language, each naming the others. */
  const reading = (path: string, live = false, images?: string[]): MetadataRoute.Sitemap => LOCALES.map(locale => ({
    url: `${origin}${localePath(locale, path)}`,
    changeFrequency: live ? 'hourly' : 'weekly',
    alternates: { languages: languageAlternates(path, origin) },
    ...(images ? { images } : {}),
  }));
  return [
    { url: `${origin}/`, changeFrequency: 'hourly' },
    ...reading('/map'),
    ...availablePages().flatMap(p => reading(pagePath(p), !!(p.live || p.liveImage), p.liveImage && [`${origin}${liveImagePath(p.liveImage)}`])),
    // Each History measure around the world; the comparisons are chunked with the place pages.
    ...worldSlugs().flatMap(slug => reading(worldPath(slug))),
    ...reading('/compare'),
    ...reading('/about'),
    // English only until the guides are translated; the place pages have their own sitemap (app/places/sitemap.ts).
    { url: `${origin}/guides`, changeFrequency: 'weekly' },
    ...availableGuides().map(g => ({ url: `${origin}${guidePath(g)}`, changeFrequency: 'monthly' as const })),
    { url: `${origin}/docs`, changeFrequency: 'weekly' },
    { url: `${origin}/privacy`, changeFrequency: 'monthly' },
    { url: `${origin}/terms`, changeFrequency: 'monthly' },
  ];
}

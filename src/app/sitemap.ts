import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { LOCALES } from '@/lib/core/i18n/locales';
import { availableGuides, guidePath } from '@/lib/platform/site/guides/guides';
import { worldPath, worldSlugs } from '@/lib/platform/site/compare/world';
import { availablePages, pagePath } from '@/lib/platform/site/layer-pages';
import { appsOut } from '@/lib/platform/native/downloads';
import { POLICY_LINKS } from '@/lib/platform/site/legal';
import { liveImagePath } from '@/lib/platform/site/live-images';
import { languageAlternates, localePath } from '@/lib/platform/site/locale-path';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { searchedInEveryLanguage, searchScope } from '@/lib/platform/site/search-scope';
import { mountainListPaths } from '@/lib/platform/site/mountains/sitemap';
import { spacePaths } from '@/lib/platform/site/space/sitemap';

// No lastModified: stamped with the request time, it would change on every fetch and crawlers learn to ignore it.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  /** A reading page in each language search's scope takes it in (none for a family kept out), each naming the others. */
  const reading = (path: string, live = false, images?: string[]): MetadataRoute.Sitemap => LOCALES.filter(locale => searchScope(path, locale)).map(locale => ({
    url: `${origin}${localePath(locale, path)}`,
    changeFrequency: live ? 'hourly' : 'weekly',
    ...(searchedInEveryLanguage(path) ? { alternates: { languages: languageAlternates(path, origin) } } : {}),
    ...(images ? { images } : {}),
  }));
  return [
    { url: `${origin}/`, changeFrequency: 'hourly' },
    ...reading('/map'),
    ...availablePages().flatMap(p => reading(pagePath(p), !!(p.live || p.liveImage), p.liveImage && [`${origin}${liveImagePath(p.liveImage)}`])),
    // Each History measure around the world; the comparisons are chunked with the place pages.
    ...worldSlugs().flatMap(slug => reading(worldPath(slug))),
    ...reading('/compare'),
    ...spacePaths().flatMap(path => reading(path, path.startsWith('/planet/'))),
    // The mountain pages themselves have their own sitemaps (app/mountain/sitemap.ts).
    ...mountainListPaths().flatMap(path => reading(path)),
    ...reading('/ramadan'),
    ...reading('/easter'),
    ...reading('/jewish-holidays'),
    ...reading('/about'),
    ...(await appsOut() ? reading('/download') : []),
    // English only until the guides are translated; the place pages have their own sitemap (app/places/sitemap.ts).
    { url: `${origin}/guides`, changeFrequency: 'weekly' },
    ...availableGuides().map(g => ({ url: `${origin}${guidePath(g)}`, changeFrequency: 'monthly' as const })),
    { url: `${origin}/docs`, changeFrequency: 'weekly' },
    ...POLICY_LINKS.filter(l => l.href !== '/about').map(l => ({ url: `${origin}${l.href}`, changeFrequency: 'monthly' as const })),
  ];
}

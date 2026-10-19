import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { LOCALES } from '@/lib/core/i18n/locales';
import { availablePages, pagePath } from '@/lib/platform/site/layer-pages';
import { languageAlternates, localePath } from '@/lib/platform/site/locale-path';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';

// No lastModified: stamped with the request time, it would change on every fetch and crawlers learn to ignore it.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  /** A reading page in every language, each naming the others. */
  const reading = (path: string, live = false): MetadataRoute.Sitemap => LOCALES.map(locale => ({
    url: `${origin}${localePath(locale, path)}`,
    changeFrequency: live ? 'hourly' : 'weekly',
    alternates: { languages: languageAlternates(path, origin) },
  }));
  return [
    { url: `${origin}/`, changeFrequency: 'hourly' },
    ...reading('/map'),
    ...availablePages().flatMap(p => reading(pagePath(p), !!p.live)),
    ...reading('/about'),
    { url: `${origin}/docs`, changeFrequency: 'weekly' },
    { url: `${origin}/privacy`, changeFrequency: 'monthly' },
  ];
}

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { cache } from 'react';
import { SiteFrame } from '@/components/site/pages/site-frame';
import { requestLocale } from '@/lib/core/i18n/request';
import { eventArticle } from '@/lib/platform/site/events/article';
import { breadcrumbs, jsonLd } from '@/lib/platform/site/json-ld';
import { localePath } from '@/lib/platform/site/locale-path';
import { readingMetadata } from '@/lib/platform/site/meta';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { shotUrl } from '@/lib/platform/site/shots';
import { bodyName, planetDescription, planetTitle } from '@/lib/platform/site/space/copy';
import { loadPlanetPage } from '@/lib/platform/site/space/planet-page';
import { planetPath } from '@/lib/platform/site/space/planets';
import { spaceImage } from '@/lib/platform/site/space/sitemap';
import { siteText } from '@/lib/platform/site/text';
import { PlanetArticle } from './planet-article';

/** The planet, its page's language and its Wikipedia article. Shared by the metadata and the page within one request. */
export const loadPlanet = cache(async (key: string) => {
  const page = await loadPlanetPage(key);
  if (!page) return null;
  const text = await siteText((await requestLocale()).locale);
  return { page, text, article: await eventArticle(page.planet.wiki, text.locale) };
});

export async function planetMetadata(key: string): Promise<Metadata> {
  const found = await loadPlanet(key);
  if (!found) return {};
  const { page, text } = found;
  return readingMetadata({
    locale: text.locale, path: planetPath(page.planet), title: planetTitle(text.t, page), description: planetDescription(text.t, page),
    image: spaceImage('planet', page.planet.key, text.locale), type: 'article',
  });
}

export async function PlanetPageView({ planetKey }: { planetKey: string }) {
  const found = await loadPlanet(planetKey);
  if (!found) return null;
  const { page, text, article } = found;
  const { t } = text;
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const index = { href: localePath(text.locale, '/spacecraft'), label: t('Spacecraft') };
  const name = bodyName(t, page.planet.key);
  return (
    <SiteFrame t={t} path={planetPath(page.planet)} trail={[index]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumbs(origin, [{ name: 'TAKIP', path: '/' }, { name: index.label, path: index.href }, { name, path: localePath(text.locale, planetPath(page.planet)) }]),
      ]) }} />
      <PlanetArticle text={text} page={page} article={article} shot={shotUrl(page.planet.layerPage ?? 'solar-system-3d')} />
    </SiteFrame>
  );
}

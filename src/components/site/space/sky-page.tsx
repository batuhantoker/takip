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
import { spaceImage } from '@/lib/platform/site/space/sitemap';
import { SKY_INDEX_PATH, skyDescription, skyPage, skyPath, skyTitle } from '@/lib/platform/site/space/sky-pages';
import { deepSkyUrl } from '@/lib/space/deep/deep-sky';
import { siteText } from '@/lib/platform/site/text';
import { SkyArticle } from './sky-article';

/** The object, its page's language and its Wikipedia article. Shared by the metadata and the page within one request. */
export const loadSky = cache(async (slug: string) => {
  const page = skyPage(slug);
  if (!page) return null;
  const text = await siteText((await requestLocale()).locale);
  return { page, text, article: await eventArticle(page.object.wiki, text.locale) };
});

export async function skyMetadata(slug: string): Promise<Metadata> {
  const found = await loadSky(slug);
  if (!found) return {};
  const { page, text, article } = found;
  return readingMetadata({
    locale: text.locale, path: skyPath(page.object.id), title: skyTitle(text.t, page), description: skyDescription(text.t, page, article?.extract ?? null),
    image: spaceImage('sky', page.object.id, text.locale), type: 'article',
  });
}

export async function SkyPageView({ slug }: { slug: string }) {
  const found = await loadSky(slug);
  if (!found) return null;
  const { page, text, article } = found;
  const { t } = text;
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const index = { href: localePath(text.locale, SKY_INDEX_PATH), label: t('Deep sky') };
  const name = t(page.object.name);
  const url = localePath(text.locale, skyPath(page.object.id));
  return (
    <SiteFrame t={t} path={skyPath(page.object.id)} trail={[index]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumbs(origin, [{ name: 'TAKIP', path: '/' }, { name: index.label, path: index.href }, { name, path: url }]),
        {
          '@context': 'https://schema.org', '@type': 'ImageObject', contentUrl: `${origin}${deepSkyUrl(page.object.id)}`,
          name, creditText: page.image.credit, acquireLicensePage: page.image.page,
        },
      ]) }} />
      <SkyArticle text={text} page={page} article={article} />
    </SiteFrame>
  );
}

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
import { SKY_INDEX_PATH, skyPath } from '@/lib/platform/site/space/sky-pages';
import { structureDescription, structurePage, structureTitle } from '@/lib/platform/site/space/structure-pages';
import { siteText } from '@/lib/platform/site/text';
import { StructureArticle } from './structure-article';

/** The structure, its page's language and its Wikipedia article, if it has one. Shared by the metadata and the page. */
export const loadStructure = cache(async (slug: string) => {
  const page = structurePage(slug);
  if (!page) return null;
  const text = await siteText((await requestLocale()).locale);
  return { page, text, article: page.wiki ? await eventArticle(page.wiki, text.locale) : null };
});

export async function structureMetadata(slug: string): Promise<Metadata> {
  const found = await loadStructure(slug);
  if (!found) return {};
  const { page, text, article } = found;
  return readingMetadata({
    locale: text.locale, path: skyPath(page.id), title: structureTitle(text.t, page), description: structureDescription(text.t, page, article?.extract ?? null),
    image: spaceImage('sky', page.id, text.locale), type: 'article',
  });
}

export async function StructurePageView({ slug }: { slug: string }) {
  const found = await loadStructure(slug);
  if (!found) return null;
  const { page, text, article } = found;
  const { t } = text;
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const index = { href: localePath(text.locale, SKY_INDEX_PATH), label: t('Deep sky') };
  const name = t(page.feature.name);
  return (
    <SiteFrame t={t} path={skyPath(page.id)} trail={[index]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumbs(origin, [{ name: 'TAKIP', path: '/' }, { name: index.label, path: index.href }, { name, path: localePath(text.locale, skyPath(page.id)) }]),
      ]) }} />
      <StructureArticle text={text} page={page} article={article} />
    </SiteFrame>
  );
}

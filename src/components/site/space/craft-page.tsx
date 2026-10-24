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
import { craftDescription, craftTitle } from '@/lib/platform/site/space/copy';
import { loadCraftPage } from '@/lib/platform/site/space/craft-page';
import { craftPath } from '@/lib/platform/site/space/roster';
import { spaceImage } from '@/lib/platform/site/space/sitemap';
import { siteText } from '@/lib/platform/site/text';
import { CraftArticle } from './craft-article';

/** The space view's picture for craft without a photo, by roster group. */
const SHOT: Record<string, string> = { mars: 'mars-3d', moon: 'moon-3d' };

/** The craft, its page's language and its Wikipedia article. Shared by the metadata and the page within one request. */
export const loadCraft = cache(async (slug: string) => {
  const page = await loadCraftPage(slug);
  if (!page) return null;
  const text = await siteText((await requestLocale()).locale);
  return { page, text, article: await eventArticle(page.craft.wiki, text.locale) };
});

export async function craftMetadata(slug: string): Promise<Metadata> {
  const found = await loadCraft(slug);
  if (!found) return {};
  const { page, text, article } = found;
  return readingMetadata({
    locale: text.locale, path: craftPath(page.craft), title: craftTitle(text.t, page),
    description: craftDescription(text.t, page, article?.lang === text.locale ? article.extract : null),
    image: spaceImage('craft', page.craft.slug, text.locale), type: 'article',
  });
}

export async function CraftPageView({ slug }: { slug: string }) {
  const found = await loadCraft(slug);
  if (!found) return null;
  const { page, text, article } = found;
  const { t } = text;
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const path = localePath(text.locale, craftPath(page.craft));
  const index = { href: localePath(text.locale, '/spacecraft'), label: t('Spacecraft') };
  return (
    <SiteFrame t={t} path={craftPath(page.craft)} trail={[index]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumbs(origin, [{ name: 'TAKIP', path: '/' }, { name: index.label, path: index.href }, { name: page.craft.name, path }]),
      ]) }} />
      <CraftArticle text={text} page={page} article={article} shot={shotUrl(SHOT[page.group] ?? 'spacecraft-tracker')} />
    </SiteFrame>
  );
}

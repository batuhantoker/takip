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
import { loadOuterPage, outerDescription, outerTitle } from '@/lib/platform/site/space/outer-page';
import { planetPath } from '@/lib/platform/site/space/planets';
import { spaceImage } from '@/lib/platform/site/space/sitemap';
import { siteText } from '@/lib/platform/site/text';
import { OuterArticle } from './outer-article';

/** The body, its page's language and its Wikipedia article. Shared by the metadata and the page within one request. */
export const loadOuter = cache(async (key: string) => {
  const page = await loadOuterPage(key);
  if (!page) return null;
  const text = await siteText((await requestLocale()).locale);
  return { page, text, article: await eventArticle(page.entry.wiki, text.locale) };
});

export async function outerMetadata(key: string): Promise<Metadata> {
  const found = await loadOuter(key);
  if (!found) return {};
  const { page, text } = found;
  return readingMetadata({
    locale: text.locale, path: planetPath(page.entry), title: outerTitle(text.t, page), description: outerDescription(text.t, page),
    image: spaceImage('planet', page.entry.key, text.locale), type: 'article',
  });
}

export async function OuterPageView({ outerKey }: { outerKey: string }) {
  const found = await loadOuter(outerKey);
  if (!found) return null;
  const { page, text, article } = found;
  const { t } = text;
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const index = { href: localePath(text.locale, '/spacecraft'), label: t('Spacecraft') };
  return (
    <SiteFrame t={t} path={planetPath(page.entry)} trail={[index]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumbs(origin, [{ name: 'TAKIP', path: '/' }, { name: index.label, path: index.href }, { name: page.def.name, path: localePath(text.locale, planetPath(page.entry)) }]),
      ]) }} />
      <OuterArticle text={text} page={page} article={article} shot={shotUrl('solar-system-3d')} />
    </SiteFrame>
  );
}

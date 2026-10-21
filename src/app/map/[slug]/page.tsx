import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { isWorldSlug, worldMetadata, WorldPage } from '@/components/site/compare/world-page';
import { TopicEvents } from '@/components/site/events/topic-events';
import { LayerArticle } from '@/components/site/pages/layer-article';
import { SiteFrame } from '@/components/site/pages/site-frame';
import { requestLocale } from '@/lib/core/i18n/request';
import { breadcrumbs, jsonLd } from '@/lib/platform/site/json-ld';
import { worldSlugs } from '@/lib/platform/site/compare/world';
import { topicEvents } from '@/lib/platform/site/events/topic-events';
import { availablePages, layerPage, pagePath } from '@/lib/platform/site/layer-pages';
import { LIVE_IMAGES, liveImagePath, liveImageTaken } from '@/lib/platform/site/live-images';
import { liveLine } from '@/lib/platform/site/live/live-line';
import { localePath } from '@/lib/platform/site/locale-path';
import { readingImage, readingMetadata } from '@/lib/platform/site/meta';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { shotUrl } from '@/lib/platform/site/shots';
import { pageIn, sectionIn, siteText } from '@/lib/platform/site/text';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

// Each History measure around the world shares the address space (components/site/compare/world-page.tsx).
export function generateStaticParams() {
  return [...availablePages().map(p => ({ slug: p.slug })), ...worldSlugs().map(slug => ({ slug }))];
}

// Shared by generateMetadata and the page within one request. The language comes from the URL (src/proxy.ts).
const load = cache(async (slug: string) => {
  const page = layerPage(slug);
  if (!page) return null;
  const text = await siteText((await requestLocale()).locale);
  return { text, page: pageIn(text, page) };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!layerPage(slug) && isWorldSlug(slug)) return worldMetadata(slug);
  const found = await load(slug);
  if (!found) return {};
  const { text, page } = found;
  return readingMetadata({
    locale: text.locale, path: pagePath(page), title: page.title, description: page.description,
    image: readingImage(page.slug, text.locale), type: 'article',
  });
}

export default async function LayerPageRoute({ params }: Props) {
  const { slug } = await params;
  if (!layerPage(slug) && isWorldSlug(slug)) return (await WorldPage({ slug })) ?? notFound();
  const found = await load(slug);
  if (!found) notFound();
  const { text, page } = found;
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const live = page.live ? await liveLine(page.live, text.t) : null;
  const shot = page.liveImage ? { id: page.liveImage, taken: await liveImageTaken(page.liveImage) } : null;
  const related = page.related.map(slug => layerPage(slug)).filter(p => !!p)
    .map(p => ({ page: pageIn(text, p), image: shotUrl(p.slug) }));
  const index = localePath(text.locale, '/map');
  const events = page.eventKinds && topicEvents(page.eventKinds);
  return (
    <SiteFrame t={text.t} path={pagePath(page)} trail={[{ href: index, label: text.t('On the map') }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumbs(origin, [
          { name: 'TAKIP', path: '/' },
          { name: sectionIn(text, page.section).label, path: index },
          { name: page.heading, path: localePath(text.locale, pagePath(page)) },
        ]),
        ...(shot ? [{
          '@context': 'https://schema.org',
          '@type': 'ImageObject',
          contentUrl: `${origin}${liveImagePath(shot.id)}`,
          name: page.heading,
          description: text.t(LIVE_IMAGES[shot.id].alt),
          creditText: LIVE_IMAGES[shot.id].credit,
          ...(shot.taken !== null ? { dateCreated: new Date(shot.taken).toISOString() } : {}),
        }] : []),
      ]) }} />
      <LayerArticle text={text} page={page} image={shotUrl(page.slug)} live={live} shot={shot} related={related}
        events={events ? <TopicEvents t={text.t} events={events} /> : undefined} />
    </SiteFrame>
  );
}

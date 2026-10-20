import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { cache } from 'react';
import { SiteFrame } from '@/components/site/pages/site-frame';
import { requestLocale } from '@/lib/core/i18n/request';
import { articleUrl } from '@/lib/core/wikipedia/refs';
import { eventArticle } from '@/lib/platform/site/events/article';
import { eventName, eventYears, isoDate, kindLabel, placeName } from '@/lib/platform/site/events/copy';
import { findEvent, type EventPage } from '@/lib/platform/site/events/event-page';
import { eventPath } from '@/lib/platform/site/events/sitemap';
import { topicForKind } from '@/lib/platform/site/events/topics';
import { breadcrumbs, jsonLd } from '@/lib/platform/site/json-ld';
import { layerPage, pagePath } from '@/lib/platform/site/layer-pages';
import { localePath } from '@/lib/platform/site/locale-path';
import { readingMetadata } from '@/lib/platform/site/meta';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { pageIn, siteText, type SiteText } from '@/lib/platform/site/text';
import { EventArticle } from './event-article';

/** What a slug names, with the page's language and its article. Shared by the metadata and the page within one request. */
export const loadEvent = cache(async (slug: string) => {
  const found = findEvent(slug);
  if (!found || 'redirect' in found) return found;
  const text = await siteText((await requestLocale()).locale);
  const article = found.page.wiki ? await eventArticle(found.page.wiki, text.locale) : null;
  // In another language an indexed event goes by its article's title there ("Salamis Deniz Muharebesi"), the name readers search for.
  const local = article && found.page.indexed && text.locale !== 'en' && article.lang === text.locale;
  return { event: found.page, text, article, name: local ? article.title : eventName(text.t, found.page) };
});

function description(text: SiteText, e: EventPage, name: string): string {
  const { t } = text;
  const place = placeName(e);
  const what = place
    ? t('{kind}, {date}, {place}.', { kind: kindLabel(t, e.kind), date: eventYears(t, e), place })
    : t('{kind}, {date}.', { kind: kindLabel(t, e.kind), date: eventYears(t, e) });
  return `${name}: ${what} ${t('Where it happened, every source that records it and the events around it, on a map of history.')}`;
}

export async function eventMetadata(slug: string): Promise<Metadata> {
  const found = await loadEvent(slug);
  if (!found || 'redirect' in found) return {};
  const { event: e, text, name } = found;
  const meta = readingMetadata({
    locale: text.locale, path: eventPath(e.slug), title: `${name}, ${eventYears(text.t, e)}`, description: description(text, e, name),
    image: `/og?event=${encodeURIComponent(e.slug)}&lang=${text.locale}`, type: 'article',
  });
  // Only events with a Wikipedia article of their own or two sources are worth a search result (docs/architecture/public-pages.md).
  return e.indexed ? meta : { ...meta, robots: { index: false, follow: true } };
}

/** The page; the route answers 404 or a redirect before it renders. */
export async function EventPageView({ slug }: { slug: string }) {
  const found = await loadEvent(slug);
  if (!found || 'redirect' in found) return null;
  const { event: e, text, article, name } = found;
  const { t } = text;
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const path = localePath(text.locale, eventPath(e.slug));
  const topic = topicForKind(e.kind);
  const history = layerPage('history-map');
  const trail = [
    ...(history ? [{ href: localePath(text.locale, pagePath(history)), label: t('History') }] : []),
    ...(topic ? [{ href: localePath(text.locale, pagePath(topic)), label: pageIn(text, topic).heading }] : []),
  ];
  const sameAs = [...new Set([e.wiki && articleUrl(e.wiki), ...e.sources.map(x => x.recordUrl)].filter(Boolean))];
  const event = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    description: article?.description ?? kindLabel(t, e.kind),
    startDate: isoDate(e.tStart, e.prec),
    ...(e.tEnd !== null && !e.ongoing ? { endDate: isoDate(e.tEnd, e.endPrec ?? e.prec) } : {}),
    url: `${origin}${path}`,
    ...(e.lat !== null && e.lon !== null ? {
      location: { '@type': 'Place', name: placeName(e) ?? name, geo: { '@type': 'GeoCoordinates', latitude: e.lat, longitude: e.lon } },
    } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
  return (
    <SiteFrame t={t} path={eventPath(e.slug)} trail={trail}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumbs(origin, [{ name: 'TAKIP', path: '/' }, ...trail.map(c => ({ name: c.label, path: c.href })), { name, path }]),
        event,
      ]) }} />
      <EventArticle text={text} event={e} name={name} article={article} kicker={topic ? { href: localePath(text.locale, pagePath(topic)), label: kindLabel(t, e.kind) } : null} />
    </SiteFrame>
  );
}

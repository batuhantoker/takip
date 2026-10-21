import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { cache } from 'react';
import { SiteFrame } from '@/components/site/pages/site-frame';
import { requestLocale } from '@/lib/core/i18n/request';
import { createTranslator } from '@/lib/core/i18n/translator';
import { articleUrl } from '@/lib/core/wikipedia/refs';
import { leadSentences } from '@/lib/core/wikipedia/summary';
import { eventArticle, type EventArticle as Article } from '@/lib/platform/site/events/article';
import { eventHeading, eventName, eventYears, isoDate, kindLabel, placeName, recordSummary } from '@/lib/platform/site/events/copy';
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

const EN = createTranslator('en', {});
// A source title past this is a sentence, not a name.
const LONG_NAME = 70;
const CJK = new Set(['zh', 'ja']);

/** What a slug names, with the page's language and its article. Shared by the metadata and the page within one request. */
export const loadEvent = cache(async (slug: string) => {
  const found = findEvent(slug);
  if (!found || 'redirect' in found) return found;
  const text = await siteText((await requestLocale()).locale);
  const article = found.page.wiki ? await eventArticle(found.page.wiki, text.locale) : null;
  const own = eventName(text.t, found.page);
  // An indexed event goes by its article's title ("Salamis Deniz Muharebesi"), the name readers search for: in another
  // language always, in English where the source's own title is a sentence (a year page's line).
  const local = article && found.page.indexed && article.lang === text.locale && (text.locale !== 'en' || own.length > LONG_NAME);
  return { event: found.page, text, article, name: local ? article.title : eventHeading(text.t, found.page) };
});

function description(text: SiteText, e: EventPage, name: string, article: Article | null): string {
  const { t } = text;
  const max = CJK.has(text.locale) ? 90 : 160;
  // Wikipedia's opening line says what the event was better than any template, so it leads where it is in this language.
  if (article?.extract && article.lang === text.locale) {
    const lead = leadSentences(article.extract, max);
    const tail = t('On a map of history, with every source that records it.');
    if ([...lead].length >= max / 2) return [...`${lead} ${tail}`].length <= max ? `${lead} ${tail}` : lead;
  }
  // GTD writes its own summary of each attack, in English.
  const summary = text.locale === 'en' ? recordSummary(e) : null;
  if (summary && summary.length >= max / 2) return leadSentences(summary, max);
  const place = placeName(e);
  const what = place
    ? t('{kind}, {date}, {place}.', { kind: kindLabel(t, e.kind), date: eventYears(t, e), place })
    : t('{kind}, {date}.', { kind: kindLabel(t, e.kind), date: eventYears(t, e) });
  // The name only where it adds to the kind ("Earthquake — Turkey: Earthquake" says it twice); source names are often English.
  const kinds = [kindLabel(t, e.kind), kindLabel(EN, e.kind)].map(k => k.toLocaleLowerCase());
  const named = [...name].length <= LONG_NAME && !kinds.some(k => name.toLocaleLowerCase().includes(k)) ? `${name}: ${what}` : what;
  const tail = t('Where it happened, every source that records it and the events around it, on a map of history.');
  return [`${named} ${tail}`, `${what} ${tail}`, named].find(d => [...d].length <= max) ?? what;
}

const ogImage = (slug: string, locale: string) => `/og?event=${encodeURIComponent(slug)}&lang=${locale}`;

export async function eventMetadata(slug: string): Promise<Metadata> {
  const found = await loadEvent(slug);
  if (!found || 'redirect' in found) return {};
  const { event: e, text, name, article } = found;
  // "2013 North Korean nuclear test" already says its year.
  const years = eventYears(text.t, e);
  const meta = readingMetadata({
    locale: text.locale, path: eventPath(e.slug), title: name.includes(years) ? name : `${name}, ${years}`, description: description(text, e, name, article),
    image: ogImage(e.slug, text.locale), type: 'article',
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
  const wikidata = (e.attrs.ids as { wikidata?: unknown } | undefined)?.wikidata;
  // A year page lists the event among others; it isn't the event.
  const records = e.sources.filter(x => !x.code.startsWith('wikipedia-years-')).map(x => x.recordUrl);
  const sameAs = [...new Set([
    e.wiki && articleUrl(e.wiki), typeof wikidata === 'string' && `https://www.wikidata.org/wiki/${wikidata}`, ...records,
  ].filter(Boolean))];
  const place = placeName(e);
  const event = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    description: article?.description ?? kindLabel(t, e.kind),
    startDate: isoDate(e.tStart, e.prec),
    ...(e.tEnd !== null && !e.ongoing ? { endDate: isoDate(e.tEnd, e.endPrec ?? e.prec) } : {}),
    url: `${origin}${path}`,
    image: `${origin}${ogImage(e.slug, text.locale)}`,
    ...(e.lat !== null && e.lon !== null ? {
      location: {
        '@type': 'Place', ...(place ? { name: place, address: place } : {}), geo: { '@type': 'GeoCoordinates', latitude: e.lat, longitude: e.lon },
      },
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

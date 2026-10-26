import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { cache } from 'react';
import { SiteFrame } from '@/components/site/pages/site-frame';
import { requestLocale } from '@/lib/core/i18n/request';
import { articleUrl, wikiRef } from '@/lib/core/wikipedia/refs';
import { eventArticle } from '@/lib/platform/site/events/article';
import { breadcrumbs, jsonLd } from '@/lib/platform/site/json-ld';
import { localePath } from '@/lib/platform/site/locale-path';
import { readingMetadata, unindexed } from '@/lib/platform/site/meta';
import { coordinatesText, countryName, kindLabel, mountainDescription, mountainTitle, placeLabel } from '@/lib/platform/site/mountains/copy';
import { nameIn, type Mountain } from '@/lib/platform/site/mountains/data';
import { findMountain, mountainPath } from '@/lib/platform/site/mountains/mountain-page';
import { mountainImage, mountainsPath } from '@/lib/platform/site/mountains/sitemap';
import { summitForecast } from '@/lib/platform/site/mountains/summit';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { siteText } from '@/lib/platform/site/text';
import { MountainArticle } from './mountain-article';

/** The article a page leads with: the one in its own language, else the English, else any it has. */
function storedArticle(m: Mountain, locale: string): string | null {
  const own = m.wiki[locale as keyof typeof m.wiki];
  if (own) return wikiRef(locale, own);
  if (m.wiki.en) return m.wiki.en;
  const [lang, title] = Object.entries(m.wiki)[0] ?? [];
  return lang && title ? wikiRef(lang, title) : null;
}

/** The mountain, its page's language, its article and the summit's forecast. Shared by the metadata and the page within one request. */
export const loadMountain = cache(async (slug: string) => {
  const found = findMountain(slug);
  if (!found || 'redirect' in found) return found;
  const text = await siteText((await requestLocale()).locale);
  const m = found.page.mountain;
  const stored = storedArticle(m, text.locale);
  const [article, forecast] = await Promise.all([stored ? eventArticle(stored, text.locale) : null, summitForecast(m)]);
  return { page: found.page, text, article, forecast, stored, name: nameIn(m.names, text.locale) ?? slug };
});

export async function mountainMetadata(slug: string): Promise<Metadata> {
  const found = await loadMountain(slug);
  if (!found || 'redirect' in found) return {};
  const { page, text, name, article } = found;
  const m = page.mountain;
  const range = m.range !== null ? placeLabel(text.t, page.places.get(m.range)) : null;
  const meta = readingMetadata({
    locale: text.locale, path: mountainPath(m.slug), title: mountainTitle(text.t, m, name, page.eruptionTotal),
    description: mountainDescription(text.t, m, name, range, article?.lang === text.locale ? article.extract : null),
    image: mountainImage(m.slug, text.locale), type: 'article',
  });
  return m.indexed ? meta : unindexed(meta);
}

export async function MountainPageView({ slug }: { slug: string }) {
  const found = await loadMountain(slug);
  if (!found || 'redirect' in found) return null;
  const { page, text, article, forecast, stored, name } = found;
  const { t } = text;
  const m = page.mountain;
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const path = localePath(text.locale, mountainPath(m.slug));
  const index = { href: localePath(text.locale, mountainsPath()), label: t('Mountains') };
  const country = m.cc[0] ? { href: localePath(text.locale, mountainsPath(m.cc[0])), label: t('Mountains in {country}', { country: countryName(t, m.cc[0]) }) } : null;
  const trail = [index, ...(country ? [country] : [])];
  const sameAs = [stored && articleUrl(stored), `https://www.wikidata.org/wiki/Q${m.qid}`].filter(Boolean);
  const mountain = {
    '@context': 'https://schema.org',
    '@type': m.kind === 'volcano' ? ['Mountain', 'Volcano'] : 'Mountain',
    name,
    description: article?.description ?? kindLabel(t, m),
    url: `${origin}${path}`,
    image: `${origin}${mountainImage(m.slug, text.locale)}`,
    geo: { '@type': 'GeoCoordinates', latitude: m.lat, longitude: m.lon, ...(m.elev !== null ? { elevation: Math.round(m.elev) } : {}) },
    ...(m.cc.length ? { containedInPlace: m.cc.map(cc => ({ '@type': 'Country', name: countryName(t, cc) })) } : {}),
    sameAs,
  };
  return (
    <SiteFrame t={t} path={mountainPath(m.slug)} trail={trail} indexed={m.indexed}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumbs(origin, [{ name: 'TAKIP', path: '/' }, ...trail.map(c => ({ name: c.label, path: c.href })), { name, path }]),
        mountain,
      ]) }} />
      <MountainArticle text={text} page={page} name={name} article={article} forecast={forecast} coords={coordinatesText(m)} />
    </SiteFrame>
  );
}

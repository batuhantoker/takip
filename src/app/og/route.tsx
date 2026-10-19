import { readFile } from 'node:fs/promises';
import { ImageResponse } from 'next/og';
import { getClientIp, isRateLimited } from '@/lib/core/net/ssrf-guard';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/core/i18n/locales';
import { getT } from '@/lib/core/i18n/request';
import { ABOUT } from '@/lib/platform/site/about-copy';
import { layerPage } from '@/lib/platform/site/layer-pages';
import { ogFontFamily, ogFonts } from '@/lib/platform/site/og-fonts';
import { describeView } from '@/lib/platform/site/share-view';
import { shotFile } from '@/lib/platform/site/shots';
import { SITE_DESCRIPTION } from '@/lib/platform/site/site-copy';
import { pageIn, sectionIn, siteText } from '@/lib/platform/site/text';
import { OgCard, OG_SIZE } from '@/components/site/pages/og-card';

/*
 * Share cards. `?page=<slug>&lang=tr` draws a reading page's card over its picture of the map; anything else is a
 * map link (/?layers=…&track=…) and draws what describeView recognises in it, so a query can't put arbitrary
 * words on a card. Outside /api/ because robots.txt keeps crawlers out of /api/ and X's card fetcher obeys it.
 */

const MAX_CACHED = 200;
const cache = new Map<string, ArrayBuffer>();

const HEADERS = { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' };

/** What each non-layer reading page shows behind its card. */
const PICTURE: Record<string, string> = { map: 'flight-tracker', about: 'world-map-1914' };

type Card = { kicker: string; title: string; subtitle: string; points?: { lat: number; lon: number }[]; picture?: string; focus?: { lat: number; lon: number } | null };

async function readingCard(page: string, locale: Locale): Promise<Card | null> {
  const text = await siteText(locale);
  const { t } = text;
  if (page === 'map') return { kicker: 'TAKIP', title: t('Everything on the map'), subtitle: t(SITE_DESCRIPTION), picture: PICTURE.map };
  if (page === 'about') {
    const about = text.copy.about ?? {};
    const s = (k: 'heading' | 'kicker') => (typeof about[k] === 'string' ? about[k] as string : ABOUT[k]);
    return { kicker: s('kicker'), title: s('heading'), subtitle: t(SITE_DESCRIPTION), picture: PICTURE.about };
  }
  const found = layerPage(page);
  if (!found) return null;
  const p = pageIn(text, found);
  return {
    kicker: sectionIn(text, p.section).label,
    title: p.heading,
    subtitle: p.lede.split(/(?<=[.。!?！？])\s*/)[0],
    points: (p.spots ?? []).map(s => ({ lat: s.view.lat, lon: s.view.lon })),
    picture: p.slug,
  };
}

async function picture(slug: string | undefined): Promise<{ uri: string; version: string } | null> {
  const file = slug && shotFile(slug);
  const data = file && await readFile(file).catch(() => null);
  return data ? { uri: `data:image/jpeg;base64,${data.toString('base64')}`, version: String(data.length) } : null;
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const pageParam = params.get('page');
  const langParam = params.get('lang');

  let card: Card;
  let locale: Locale;
  let key: string;
  if (pageParam && /^[a-z0-9-]{1,64}$/.test(pageParam)) {
    locale = isLocale(langParam) ? langParam : DEFAULT_LOCALE;
    const found = await readingCard(pageParam, locale);
    if (!found) return new Response('Not found', { status: 404 });
    card = found;
    key = `page:${pageParam}:${locale}`;
  } else {
    const t = await getT();
    const view = describeView(Object.fromEntries(params), t);
    locale = t.locale;
    card = { kicker: t('Live map'), title: view.title ?? t('The world, live'), subtitle: view.caption, focus: view.at };
    key = `view:${locale}:${view.imageQuery}`;
  }

  const background = await picture(card.picture);
  key += `:${background?.version ?? '-'}`;
  const hit = cache.get(key);
  if (hit) return new Response(hit, { headers: HEADERS });
  // Drawing is CPU work on a small machine; cached cards above stay free.
  if (isRateLimited(`og:${getClientIp(req)}`, 30)) return new Response('Too many requests', { status: 429 });

  // A script Geist can't draw needs a font fetched for it; without one, the card is drawn in English.
  let fonts = await ogFonts(locale, `${card.kicker}${card.title}${card.subtitle}TAKIP`);
  if (fonts === null) {
    const english = pageParam ? await readingCard(pageParam, DEFAULT_LOCALE) : null;
    if (english) card = english;
    fonts = undefined;
  }
  const draw = (c: Card, withFonts: typeof fonts) => new ImageResponse(
    <OgCard kicker={c.kicker} title={c.title} subtitle={c.subtitle} points={c.points} focus={c.focus}
      background={background?.uri} font={withFonts ? ogFontFamily(locale) : 'Geist'} />,
    { ...OG_SIZE, ...(withFonts ? { fonts: withFonts } : {}) },
  ).arrayBuffer();
  // Satori can't lay out every script (Arabic among them); a card in English beats no card.
  const png = await draw(card, fonts).catch(async () => draw((pageParam && await readingCard(pageParam, DEFAULT_LOCALE)) || card, undefined));
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(key, png);
  return new Response(png, { headers: HEADERS });
}

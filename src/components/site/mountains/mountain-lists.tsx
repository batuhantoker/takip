import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import AdSlot from '@/components/shell/ads/ad-slot';
import { Section, SiteFrame, TEXT_LINK } from '@/components/site/pages/site-frame';
import { PlaceMap } from '@/components/site/places/parts/place-header';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { getT } from '@/lib/core/i18n/request';
import type { Translate } from '@/lib/core/i18n/translator';
import { AD_SLOTS } from '@/lib/platform/ads';
import { embedHref } from '@/lib/map/embed/spec';
import { breadcrumbs, jsonLd } from '@/lib/platform/site/json-ld';
import { localePath } from '@/lib/platform/site/locale-path';
import { mapHref } from '@/lib/platform/site/map-link';
import { readingMetadata, unindexed } from '@/lib/platform/site/meta';
import { countryName, countryOf, feetFirst, heightShort, placeLabel } from '@/lib/platform/site/mountains/copy';
import { nameIn, type Mountain } from '@/lib/platform/site/mountains/data';
import { mountainPath } from '@/lib/platform/site/mountains/mountain-page';
import { COUNTRY_INDEX_MIN, mountainsImage, mountainsPath } from '@/lib/platform/site/mountains/sitemap';
import { countrySummaries, highestInCountry, highestOnEarth, mountainsByQid, placesByQid, placeSummits } from '@/lib/platform/site/mountains/store';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { placePath } from '@/lib/platform/site/places/paths';

const WORLD_LIST = 50;
const COUNTRY_LIST = 100;
const CJK = new Set(['zh', 'ja']);

const fit = (t: Translate, options: string[]) => options.find(s => [...s].length <= (CJK.has(t.locale) ? 32 : 60)) ?? options[options.length - 1];

/** Every country with mountains, its highest beside it, the best covered first. */
function CountryGrid({ t, current }: { t: Translate; current?: string }) {
  const rows = countrySummaries().filter(c => c.indexed > 0 && c.cc !== current);
  const tops = mountainsByQid(rows.map(r => r.top));
  return (
    <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(r => {
        const top = tops.get(r.top);
        return (
          <li key={r.cc} className="flex items-baseline justify-between gap-3 border-b border-line py-2">
            <Link href={localePath(t.locale, mountainsPath(r.cc))} className={cx('text-ink-1 hover:text-accent', FOCUS_RING)}>{countryName(t, r.cc)}</Link>
            {top?.elev != null && <span className="truncate text-[13px] text-ink-3">{nameIn(top.names, t.locale)} · {heightShort(t, top.elev, feetFirst(top))}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** Ranked rows: number, name, height, country; each marks the map beside the list. */
function Ranked({ t, peaks }: { t: Translate; peaks: Mountain[] }) {
  return (
    <ol className="grid">
      {peaks.map((p, i) => {
        const name = nameIn(p.names, t.locale) ?? p.slug;
        return (
          <li key={p.qid} data-map={`${p.lon},${p.lat}`} data-map-id={`Q${p.qid}`} data-map-label={name}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line py-2.5 last:border-0">
            <span className="text-[13px] text-ink-3 tabular-nums">{i + 1}</span>
            <span className="min-w-0">
              <Link href={localePath(t.locale, mountainPath(p.slug))} rel={p.indexed ? undefined : 'nofollow'} className={cx('font-medium text-ink-1 hover:text-accent', FOCUS_RING)}>{name}</Link>
              <span className="block truncate text-[13px] text-ink-3">{p.cc.map(cc => countryName(t, cc)).join(', ')}</span>
            </span>
            <span className="text-[14px] text-ink-1 tabular-nums">{p.elev !== null ? heightShort(t, p.elev, feetFirst(p)) : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ListLayout({ t, children, embed, open, heading, focus }: {
  t: Translate; children: ReactNode; embed: string; open: string; heading: string; focus: { lat: number; lon: number; zoom: number };
}) {
  return (
    <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
      <div>
        <div className="mb-10 lg:hidden"><PlaceMap t={t} heading={heading} open={open} embed={embed} focus={focus} image={null} live={false} mode="phone" /></div>
        {children}
      </div>
      <aside className="flex flex-col gap-10">
        <div className="hidden flex-1 lg:block">
          <div className="sticky top-14"><PlaceMap t={t} heading={heading} open={open} embed={embed} focus={focus} image={null} live={false} mode="beside" /></div>
        </div>
        <AdSlot slot={AD_SLOTS.page} variant="page" />
      </aside>
    </div>
  );
}

export async function mountainsIndexMetadata(): Promise<Metadata> {
  const t = await getT();
  return readingMetadata({
    locale: t.locale, path: mountainsPath(),
    title: fit(t, [t('Highest mountains in the world: list, heights and map'), t('Highest mountains in the world')]),
    description: t('The world’s highest mountains and volcanoes ranked, each continent’s and country’s highest point, and a page for every peak with its summit weather.'),
    image: mountainsImage(null, t.locale),
  });
}

/** /mountains: the world's highest, the highest point of each continent, and every country's list. */
export async function MountainsIndex() {
  const t = await getT();
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const highest = highestOnEarth(WORLD_LIST);
  const summits = placeSummits();
  const places = placesByQid(summits.flatMap(s => s.highest));
  const continents = summits
    .flatMap(s => s.highest.filter(q => places.get(q)?.kind === 'continent').map(q => ({ mountain: s, continent: placeLabel(t, places.get(q)) ?? '' })))
    .sort((a, b) => (b.mountain.elev ?? 0) - (a.mountain.elev ?? 0));
  const heading = t('Mountains');
  const focus = { lat: 30, lon: 40, zoom: 1.6 };
  return (
    <SiteFrame t={t} path={mountainsPath()}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumbs(origin, [{ name: 'TAKIP', path: '/' }, { name: heading, path: localePath(t.locale, mountainsPath()) }]),
      ]) }} />
      <header className="mt-8 max-w-[44rem]">
        <h1 className="text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{t('The world’s highest mountains')}</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
          {t('Every mountain, hill and volcano with a Wikipedia article: how high it is, the weather at its summit, the peaks around it, and a 3D map of it.')}
        </p>
      </header>
      <ListLayout t={t} heading={heading} focus={focus} open={mapHref({ layers: ['terrain_elevation'], view: focus })}
        embed={localePath(t.locale, embedHref({ layers: [], view: focus }))}>
        <Section title={t('The {n} highest', { n: highest.length })}>
          <Ranked t={t} peaks={highest} />
          <p className="mt-3 text-[13px] text-ink-3">{t('A summit less than 300 m above its saddle with a higher one counts as part of that mountain.')}</p>
        </Section>
        {continents.length > 0 && (
          <Section title={t('The highest point of each continent')}>
            <ul className="grid gap-x-8 sm:grid-cols-2">
              {continents.map(({ mountain: p, continent }) => (
                <li key={`${p.qid}-${continent}`} data-map={`${p.lon},${p.lat}`} data-map-id={`Q${p.qid}`} data-map-label={nameIn(p.names, t.locale) ?? ''}
                  className="border-b border-line py-2.5">
                  <span className="block text-[13px] text-ink-3">{continent}</span>
                  <Link href={localePath(t.locale, mountainPath(p.slug))} className={cx('font-medium text-ink-1 hover:text-accent', FOCUS_RING)}>{nameIn(p.names, t.locale)}</Link>
                  {p.elev !== null && <span className="ml-2 text-[13px] text-ink-3 tabular-nums">{heightShort(t, p.elev, feetFirst(p))}</span>}
                </li>
              ))}
            </ul>
          </Section>
        )}
        <Section title={t('Mountains by country')}>
          <CountryGrid t={t} />
        </Section>
      </ListLayout>
    </SiteFrame>
  );
}

/** The country a /mountains/<slug> names, by the gazetteer's country slug. */
export function countryForSlug(slug: string): string | null {
  const cc = countrySummaries().find(c => countryOf(c.cc)?.slug === slug)?.cc;
  return cc ?? null;
}

export async function countryMountainsMetadata(cc: string): Promise<Metadata> {
  const t = await getT();
  const country = countryName(t, cc);
  const peaks = highestInCountry(cc, COUNTRY_LIST);
  const top = peaks[0];
  const meta = readingMetadata({
    locale: t.locale, path: mountainsPath(cc),
    title: fit(t, [t('Highest mountains in {country}: list, heights and map', { country }), t('Highest mountains in {country}', { country })]),
    description: top?.elev != null
      ? t('{country}’s {n} highest mountains ranked by height, from {top} at {height} down, each with its summit weather forecast and a 3D map.', {
        country, n: peaks.length, top: nameIn(top.names, t.locale) ?? '', height: heightShort(t, top.elev, feetFirst(top)),
      })
      : t('The mountains of {country} ranked by height, each with its summit weather forecast and a 3D map.', { country }),
    image: mountainsImage(cc, t.locale),
  });
  const indexed = countrySummaries().find(c => c.cc === cc)?.indexed ?? 0;
  return indexed >= COUNTRY_INDEX_MIN ? meta : unindexed(meta);
}

/** /mountains/<country>: its mountains by height, its highest point, and the way to every other country's list. */
export async function CountryMountains({ cc }: { cc: string }) {
  const t = await getT();
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const country = countryName(t, cc);
  const peaks = highestInCountry(cc, COUNTRY_LIST);
  const total = countrySummaries().find(c => c.cc === cc)?.n ?? peaks.length;
  const top = peaks[0];
  const place = countryOf(cc);
  const lons = peaks.map(p => p.lon);
  const lats = peaks.map(p => p.lat);
  const bbox = peaks.length > 1 ? [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)] as const : null;
  const focus = top ? { lat: top.lat, lon: top.lon, zoom: 5 } : { lat: 0, lon: 0, zoom: 1.6 };
  const index = { href: localePath(t.locale, mountainsPath()), label: t('Mountains') };
  const heading = t('Mountains in {country}', { country });
  return (
    <SiteFrame t={t} path={mountainsPath(cc)} trail={[index]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumbs(origin, [{ name: 'TAKIP', path: '/' }, { name: index.label, path: index.href }, { name: heading, path: localePath(t.locale, mountainsPath(cc)) }]),
      ]) }} />
      <header className="mt-8 max-w-[44rem]">
        <Link href={index.href} className={cx('text-[13px] font-medium text-ink-3 hover:text-ink-1', FOCUS_RING)}>{t('The world’s highest mountains')}</Link>
        <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{t('Highest mountains in {country}', { country })}</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
          {top?.elev != null
            ? t('{country}’s highest is {top} at {height}. Here are its {n} highest of the {total} with a known height, each with a page of its own.', {
              country, top: nameIn(top.names, t.locale) ?? '', height: heightShort(t, top.elev, feetFirst(top)), n: peaks.length, total,
            })
            : t('The mountains of {country} with a known height, each with a page of its own.', { country })}
        </p>
        {place && <p className="mt-4 text-[14px]"><Link href={localePath(t.locale, placePath(place))} className={TEXT_LINK}>{t('{country} on the live map', { country })}</Link></p>}
      </header>
      <ListLayout t={t} heading={heading} focus={focus} open={mapHref({ layers: ['terrain_elevation'], view: focus })}
        embed={localePath(t.locale, embedHref(bbox ? { layers: [], bbox } : { layers: [], view: focus }))}>
        <Section title={t('By height')}>
          <Ranked t={t} peaks={peaks} />
          <p className="mt-3 text-[13px] text-ink-3">{t('Heights from Wikidata, for peaks with a Wikipedia article; a peak without one isn’t listed.')} {t('A summit less than 300 m above its saddle with a higher one counts as part of that mountain.')}</p>
        </Section>
        <Section title={t('Mountains in other countries')}>
          <CountryGrid t={t} current={cc} />
        </Section>
      </ListLayout>
    </SiteFrame>
  );
}

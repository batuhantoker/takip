import type { Metadata } from 'next';
import Link from 'next/link';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { Section, SiteFrame } from '@/components/site/pages/site-frame';
import { requestLocale } from '@/lib/core/i18n/request';
import { localePath } from '@/lib/platform/site/locale-path';
import { readingMetadata } from '@/lib/platform/site/meta';
import { count, nameOf } from '@/lib/platform/site/places/copy/format';
import { countryPlace } from '@/lib/platform/site/places/gazetteer';
import { indexedPages } from '@/lib/platform/site/places/pages';
import { placePath } from '@/lib/platform/site/places/paths';
import { siteText } from '@/lib/platform/site/text';
import { PlaceList } from './parts/place-links';

/** Countries with places that have pages, the most first, and the biggest places. */
function census() {
  const places = [...new Map(indexedPages('city').map(p => [p.place.id, p.place])).values()];
  const byCountry = new Map<string, number>();
  for (const p of places) byCountry.set(p.cc, (byCountry.get(p.cc) ?? 0) + 1);
  const countries = [...byCountry].flatMap(([cc, n]) => {
    const c = countryPlace(cc);
    return c ? [{ country: c, n }] : [];
  });
  return { places, countries };
}

export async function placesIndexMetadata(kind: 'city' | 'country'): Promise<Metadata> {
  const { t, locale } = await siteText((await requestLocale()).locale);
  return readingMetadata({
    locale, path: kind === 'city' ? '/city' : '/country', image: '/og',
    title: kind === 'city' ? t('Cities on the live map: transit, cameras and weather') : t('Countries on the live map: their cities, live'),
    description: kind === 'city'
      ? t('Every city and town with its own page on TAKIP: who runs its buses and trains, its public cameras, its airports and its weather, from real data.')
      : t('Every country with places on TAKIP’s live map, and the cities in each: their buses and trains, public cameras, airports and weather.'),
  });
}

export async function PlacesIndex({ kind }: { kind: 'city' | 'country' }) {
  const text = await siteText((await requestLocale()).locale);
  const { t } = text;
  const { places, countries } = census();
  const sorted = countries.sort((a, b) => nameOf(a.country, t).localeCompare(nameOf(b.country, t), t.intl));
  const biggest = [...places].sort((a, b) => b.pop - a.pop).slice(0, kind === 'city' ? 120 : 0);
  return (
    <SiteFrame t={t} path={kind === 'city' ? '/city' : '/country'} trail={[{ href: localePath(t.locale, '/map'), label: t('On the map') }]}>
      <header className="mt-8 max-w-[44rem]">
        <h1 className="text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{kind === 'city' ? t('Cities, live') : t('Countries, live')}</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
          {t('{places} places in {countries} countries have a page of their own: what the live map has there, and where the data comes from.', {
            places: count(places.length, t), countries: count(countries.length, t),
          })}
        </p>
      </header>
      {biggest.length > 0 && (
        <Section title={t('The biggest')} className="mt-14">
          <PlaceList text={text} places={biggest} />
        </Section>
      )}
      <Section title={t('By country')} className="mt-14">
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          {sorted.map(({ country, n }) => (
            <li key={country.cc} className="text-[14px]">
              <Link href={localePath(t.locale, placePath(country))} className={cx('text-ink-1 hover:text-accent', FOCUS_RING)}>{nameOf(country, t)}</Link>
              <span className="text-ink-3"> · {count(n, t)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </SiteFrame>
  );
}

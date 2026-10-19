import type { Metadata } from 'next';
import { Section, SiteFrame } from '@/components/site/pages/site-frame';
import { requestLocale } from '@/lib/core/i18n/request';
import { localePath } from '@/lib/platform/site/locale-path';
import { readingMetadata } from '@/lib/platform/site/meta';
import { count, nameOf } from '@/lib/platform/site/places/copy/format';
import { allPlaces, placeById } from '@/lib/platform/site/places/gazetteer';
import { placePages } from '@/lib/platform/site/places/pages';
import type { Place } from '@/lib/platform/site/places/place';
import { KIND_INDEX } from '@/lib/platform/site/places/paths';
import { siteText } from '@/lib/platform/site/text';
import { PlaceList } from './parts/place-links';

type AreaKind = 'state' | 'county' | 'town';

/** US states, or counties or towns by state, with an indexed page, by name. */
function indexed(kind: AreaKind, t: { intl: string }): Place[] {
  return allPlaces().filter(p => p.kind === kind && placePages(p).some(x => x.page.index))
    .sort((a, b) => a.name.localeCompare(b.name, t.intl));
}

export async function areasIndexMetadata(kind: AreaKind): Promise<Metadata> {
  const { t, locale } = await siteText((await requestLocale()).locale);
  return readingMetadata({
    locale, path: KIND_INDEX[kind], image: '/og',
    title: kind === 'state' ? t('US states on the live map: Flock cameras by state')
      : kind === 'county' ? t('US counties on the live map: Flock cameras by county') : t('US towns on the live map: Flock cameras by town'),
    description: kind === 'state'
      ? t('Every US state with its own page on TAKIP: the licence-plate readers mapped there, Flock cameras among them, who runs them and which counties have the most.')
      : kind === 'county'
        ? t('Every US county with its own page on TAKIP: the licence-plate readers mapped there, Flock cameras among them, who runs them and which way they face.')
        : t('Every US town with its own page on TAKIP: the licence-plate readers mapped inside its limits, Flock cameras among them, who runs them and which way they face.'),
  });
}

export async function AreasIndex({ kind }: { kind: AreaKind }) {
  const text = await siteText((await requestLocale()).locale);
  const { t } = text;
  const places = indexed(kind, t);
  const byState = new Map<number, Place[]>();
  if (kind !== 'state') for (const p of places) byState.set(p.parents?.[0] ?? 0, [...(byState.get(p.parents?.[0] ?? 0) ?? []), p]);
  const states = [...byState].flatMap(([id, list]) => {
    const state = placeById(id);
    return state ? [{ state, list }] : [];
  }).sort((a, b) => a.state.name.localeCompare(b.state.name, t.intl));
  return (
    <SiteFrame t={t} path={KIND_INDEX[kind]} trail={[{ href: localePath(t.locale, '/city'), label: t('Places') }]}>
      <header className="mt-8 max-w-[44rem]">
        <h1 className="text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{kind === 'state' ? t('US states, live') : kind === 'county' ? t('US counties, live') : t('US towns, live')}</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
          {kind === 'state'
            ? t('{n, plural, one {One state has} other {# states have}} a page of their own: what the live map has there, and where the data comes from.', { n: places.length })
            : kind === 'county'
              ? t('{n} counties have a page of their own: what the live map has there, and where the data comes from.', { n: count(places.length, t) })
              : t('{n} towns have a page of their own: what the live map has there, and where the data comes from.', { n: count(places.length, t) })}
        </p>
      </header>
      {kind === 'state' ? (
        <Section title={t('States')} className="mt-14">
          <PlaceList text={text} places={places} />
        </Section>
      ) : states.map(({ state, list }) => (
        <Section key={state.id} title={nameOf(state, t)} className="mt-14">
          <PlaceList text={text} places={list} />
        </Section>
      ))}
    </SiteFrame>
  );
}

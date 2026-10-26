import { Activity, CloudRain, Flame, TriangleAlert, Zap, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-parts';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import type { NearKind } from '@/lib/feeds/hazards/near-now';
import { localePath } from '@/lib/platform/site/locale-path';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { placePath } from '@/lib/platform/site/places/paths';
import type { Place } from '@/lib/platform/site/places/place';
import { NOW_TOPICS, nowCitiesOf, type NowCity, type NowCountry, type NowData, type NowLive } from '@/lib/platform/site/places/topics/now';
import type { SiteText } from '@/lib/platform/site/text';
import { Notes } from '../parts/notes';
import type { TopicView } from './view';

const CARD = cx('block h-full rounded-card border border-line bg-surface-1 p-4 hover:bg-surface-2', FOCUS_RING, TRANSITION);

const ICON: Record<NearKind, LucideIcon> = { warning: TriangleAlert, earthquake: Activity, fire: Flame, lightning: Zap, rain: CloudRain };

function CityBody({ text, place, data }: { text: SiteText; place: Place; data: NowCity }) {
  const { t } = text;
  const city = nameOf(place, t);
  const pages = NOW_TOPICS.filter(topic => data.pages.includes(topic.id))
    .map(topic => ({ topic, page: topic.pages(place)[0] }))
    .filter(x => !!x.page);
  return (
    <>
      {pages.length > 0 && (
        <Section title={t('Live on TAKIP for {city}', { city })}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {pages.map(({ topic, page }) => (
              <li key={topic.id}>
                <Link href={localePath(t.locale, placePath(place, page.slug))} className={CARD}>
                  <span className="block text-[15px] font-medium text-ink-1">{t(page.label ?? topic.label)}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-ink-2">{topic.summary(place, page, t)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Notes text={text} layers={['severe-weather', 'earthquakes', 'wildfires', ...(data.lightning ? ['lightning-map'] : []), ...(data.radar ? ['rain-radar'] : [])]} notes={[
        ...(data.radar ? [] : [t('No ground radar in RainViewer’s mosaic reaches {city}.', { city })]),
        ...(data.lightning ? [] : [t('Not covered: no lightning network on the map reaches {city}.', { city })]),
        t('It looks {quake, radius} out for earthquakes of the last day, about {warning, radius} for warnings and named fires, {hotspot, radius} for fires seen by satellite and {lightning, radius} for lightning in the last 15 minutes.', { quake: 300, warning: 100, hotspot: 25, lightning: 50 }),
        t('It is checked again every two minutes, and the TAKIP app shows the same in its Near you widget.'),
      ]} />
    </>
  );
}

function CountryBody({ text, place, data }: { text: SiteText; place: Place; data: NowCountry }) {
  const { t } = text;
  const country = nameOf(place, t);
  const cities = nowCitiesOf(place.cc).filter(c => data.cities.includes(c.id));
  return (
    <>
      {cities.length > 0 && (
        <Section title={t('Right now in the cities of {country}', { country })}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {cities.map(c => (
              <li key={c.id}>
                <Link href={localePath(t.locale, placePath(c, 'now'))} className={CARD}>
                  <span className="block text-[15px] font-medium text-ink-1">{nameOf(c, t)}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-ink-2">{t('Warnings, earthquakes, fires, lightning and rain around {city} now', { city: nameOf(c, t) })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Notes text={text} layers={['severe-weather', 'earthquakes', 'wildfires']} notes={[
        t('Counted inside the rectangle that frames {country} on the map, so what lies just across a border counts too.', { country }),
        t('It counts the warnings in force, the strongest earthquake of magnitude 2.5 or more in the last day, and fires named by their agencies, or else seen by satellite in the last day.'),
      ]} />
    </>
  );
}

export const NOW_VIEW: TopicView<NowData, NowLive> = {
  icon: Activity,

  Live: ({ text, place, live }) => {
    const { t } = text;
    if (!live.items.length) {
      return <p>{place.kind === 'country'
        ? t('Nothing in force or recent in and around {country} right now', { country: nameOf(place, t) })
        : t('Nothing near {city} right now', { city: nameOf(place, t) })}</p>;
    }
    return (
      <ul className="flex flex-col gap-2">
        {live.items.map(item => {
          const Icon = ICON[item.kind];
          return (
            <li key={item.kind} className="flex items-baseline gap-2">
              <Icon className="size-4 flex-shrink-0 translate-y-0.5 text-ink-3" aria-hidden />
              <a href={item.path} className={TEXT_LINK}>{item.title}</a>
              <span className="text-[13px] text-ink-3">{item.detail}</span>
            </li>
          );
        })}
      </ul>
    );
  },

  Body({ text, place, page: { data } }) {
    return data.scope === 'country' ? <CountryBody text={text} place={place} data={data} /> : <CityBody text={text} place={place} data={data} />;
  },
};

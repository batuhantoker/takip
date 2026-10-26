import { Route } from 'lucide-react';
import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-parts';
import { cx } from '@/components/ui/class-names';
import { viewPath } from '@/lib/map/view-link';
import { kmBetween } from '@/lib/places/attractions/plan';
import { DAY_INK } from '@/lib/places/attractions/plan-layers';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { placeById } from '@/lib/platform/site/places/gazetteer';
import { placePages } from '@/lib/platform/site/places/pages';
import { placePath } from '@/lib/platform/site/places/paths';
import type { Place } from '@/lib/platform/site/places/place';
import { attractionWiki, KIND_LABEL } from '@/lib/platform/site/places/topics/attractions-data';
import { ONE_DAY, stopName, type PlanDayData, type PlanDetail, type PlansData } from '@/lib/platform/site/places/topics/plans';
import type { SiteText } from '@/lib/platform/site/text';
import { Notes } from '../parts/notes';
import { mapRow } from './attractions-body';
import { DayTrips } from './parts/day-trips';
import { PhotoCredits, PhotoThumb, type Photos } from './parts/photos';
import type { TopicView } from './view';

const point = (s: PlanDayData['stops'][number]) => ({ id: s.id, at: s.item.at, l: s.item.l });

function Day({ text, day, n, photos, walk }: { text: SiteText; day: PlanDayData; n: number; photos?: Photos | null; walk?: { km: number; minutes: number } }) {
  const { t } = text;
  const ink = DAY_INK[(n - 1) % DAY_INK.length];
  return (
    <>
      <ol>
        {day.stops.map((s, i) => {
          const prev = day.stops[i - 1];
          const on = prev && Math.round(kmBetween(point(prev), point(s)) * 10) / 10;
          return (
            <li key={s.id} className="flex gap-4 border-b border-line py-3 last:border-b-0" {...mapRow(s.id, s.item, t.locale)}>
              <span aria-hidden className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-semibold tabular-nums text-surface-0"
                style={{ background: ink }}>{i + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <a href={attractionWiki(s.id, s.item, t.locale)} target="_blank" rel="noopener" className={cx(TEXT_LINK, 'text-[15px] font-medium')}>{stopName(s, t.locale)}</a>
                <span className="text-[13px] text-ink-3">
                  {[
                    t(KIND_LABEL[s.item.k]),
                    prev && (on! < 0.1
                      ? t('Next to {place}', { place: stopName(prev, t.locale) })
                      : t('{km, distance} on from {place}', { km: on, place: stopName(prev, t.locale) })),
                  ].filter(Boolean).join(' · ')}
                  {' · '}
                  <a href={viewPath({ lat: s.item.at[1], lng: s.item.at[0], zoom: 16, layers: { things_to_do: true } })} data-map-jump={16} className="hover:text-ink-1">{t('On the map')}</a>
                </span>
              </span>
              <PhotoThumb photo={photos?.[s.id]} size={64} />
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[13px] text-ink-3">
        {walk
          ? t('{n, plural, one {# stop} other {# stops}}, {km, distance} on foot along the streets: about {h, plural, =0 {} other {# h }}{m} min of walking.', { n: day.stops.length, km: walk.km, h: Math.floor(walk.minutes / 60), m: walk.minutes % 60 })
          : t('{n, plural, one {# stop} other {# stops}}, about {km, distance} between them in straight lines.', { n: day.stops.length, km: Math.max(0.1, Math.round(day.km * 10) / 10) })}
      </p>
    </>
  );
}

/** The day's city's own one-day plan, where it has one. */
function CityPlan({ text, city }: { text: SiteText; city: Place }) {
  const { t } = text;
  const own = placePages(city).find(p => p.topic.id === 'plans' && p.page.slug === ONE_DAY);
  return own ? (
    <p className="-mt-1 mb-2 text-[14px]">
      <Link href={localePath(t.locale, placePath(city, own.page.slug))} rel={crawlRel(own.page.index)} className={TEXT_LINK}>
        {own.topic.header(city, own.page, t).heading}
      </Link>
    </p>
  ) : null;
}

export const PLANS_VIEW: TopicView<PlansData, never, PlanDetail> = {
  icon: Route,
  mapBeside: true,

  Body({ text, place, page, detail }) {
    const { t } = text;
    const { days } = page.data;
    const others = placePages(place).filter(p => (p.topic.id === 'plans' || p.topic.id === 'attractions') && p.page.slug !== page.slug);
    return (
      <>
        {days.map((day, i) => {
          const city = day.city ? placeById(day.city) : undefined;
          const title = days.length === 1 ? t('The route') : city ? t('Day {n}: {city}', { n: i + 1, city: nameOf(city, t) }) : t('Day {n}', { n: i + 1 });
          return (
            <div key={i} data-map-route="" className="mt-12 first:mt-0">
              <Section title={title}>
                {city && <CityPlan text={text} city={city} />}
                <Day text={text} day={day} n={i + 1} photos={detail?.photos} walk={detail?.walks[i + 1]} />
              </Section>
            </div>
          );
        })}
        {others.length > 0 && (
          <Section title={t('More for {place}', { place: nameOf(place, t) })}>
            <ul className="flex flex-col gap-2">
              {others.map(({ topic, page: other }) => (
                <li key={other.slug}>
                  <Link href={localePath(t.locale, placePath(place, other.slug))} rel={crawlRel(other.index)} className={cx(TEXT_LINK, 'text-[15px] font-medium')}>
                    {topic.header(place, other, t).heading}
                  </Link>
                  <span className="text-[14px] text-ink-3"> · {topic.summary(place, other, t)}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <DayTrips text={text} place={place} />
        <PhotoCredits text={text} credits={[...new Map(days.flatMap(d => d.stops).flatMap(s => (detail?.photos?.[s.id] ? [[s.id, { name: stopName(s, t.locale), photo: detail.photos[s.id] }] as const] : []))).values()]} />
        <Notes text={text} layers={[]} notes={[
          t('Each day starts at the best-known place not yet seen and adds the best known within a short walk of it, then puts them in the shortest order. The places come from Wikidata (CC0), ranked by how many Wikipedias have an article about them.'),
          t('The map draws each day’s walk along the streets, routed by Valhalla on OpenStreetMap; the distances beside the stops are straight lines.'),
          t('Opening hours, tickets and closures are not checked: each place’s Wikipedia article has them.'),
        ]} />
      </>
    );
  },
};

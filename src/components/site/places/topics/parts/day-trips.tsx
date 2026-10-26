import Link from 'next/link';
import { Section } from '@/components/site/pages/site-parts';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { placePath } from '@/lib/platform/site/places/paths';
import type { Place } from '@/lib/platform/site/places/place';
import { attractionName } from '@/lib/platform/site/places/topics/attractions-data';
import { dayTrips } from '@/lib/platform/site/places/topics/day-trips';
import type { SiteText } from '@/lib/platform/site/text';
import { WithFigures } from '../../parts/place-links';

/** Where to go for a day from here: each place's best-known sight, leading to its own plan or its things to do. */
export function DayTrips({ text, place }: { text: SiteText; place: Place }) {
  const { t } = text;
  const trips = dayTrips(place);
  if (!trips.length) return null;
  return (
    <Section title={t('Day trips from {city}', { city: nameOf(place, t) })}>
      <ul className="grid border-t border-line sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-4">
        {trips.map(trip => {
          const lead = trip.plan ?? trip.things;
          return (
            <li key={trip.place.id} className="border-b border-line">
              <Link href={localePath(t.locale, placePath(trip.place, lead.page.slug))} rel={crawlRel(lead.page.index)}
                className={cx('group flex h-full flex-col gap-0.5 py-3.5', FOCUS_RING)}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className={cx('text-[15px] leading-6 font-medium text-ink-1 group-hover:text-accent', TRANSITION)}>{nameOf(trip.place, t)}</span>
                  <span className="shrink-0 text-[12px] text-ink-3"><WithFigures text={t('{km, distance} away', { km: trip.km })} /></span>
                </span>
                <span className="text-[14px] leading-[22px] text-ink-2">{attractionName(trip.best.item, t.locale)}</span>
                <span className="text-[13px] leading-5 text-ink-3"><WithFigures text={lead.topic.summary(trip.place, lead.page, t)} /></span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

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

/** Where to go for a day from here: each place's best-known sight, leading to its own plan or its things to do. */
export function DayTrips({ text, place }: { text: SiteText; place: Place }) {
  const { t } = text;
  const trips = dayTrips(place);
  if (!trips.length) return null;
  return (
    <Section title={t('Day trips from {city}', { city: nameOf(place, t) })}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {trips.map(trip => {
          const lead = trip.plan ?? trip.things;
          return (
            <li key={trip.place.id}>
              <Link href={localePath(t.locale, placePath(trip.place, lead.page.slug))} rel={crawlRel(lead.page.index)}
                className={cx('flex h-full flex-col gap-1 rounded-card border border-line bg-surface-1 p-4 hover:border-line-strong hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-semibold text-ink-1">{nameOf(trip.place, t)}</span>
                  <span className="shrink-0 text-[13px] tabular-nums text-ink-3">{t('{km, distance} away', { km: trip.km })}</span>
                </span>
                <span className="text-[14px] text-ink-2">{attractionName(trip.best.item, t.locale)}</span>
                <span className="mt-1 text-[13px] text-ink-3">{lead.topic.summary(trip.place, lead.page, t)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

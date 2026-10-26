import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { placeIndexed } from '@/lib/platform/site/places/pages';
import { placePath } from '@/lib/platform/site/places/paths';
import { prayerToday } from '@/lib/platform/site/places/topics/prayer';
import { longDay, PRAYER_LABEL, prayerClock, waitOf } from '@/lib/platform/site/places/topics/prayer-copy';
import { nextPrayer } from '@/lib/platform/site/places/topics/prayer-times';
import type { PrayersData } from '@/lib/platform/site/places/topics/prayers';
import { ramadanLabel } from '@/lib/platform/site/places/topics/ramadan';
import { nearestRamadan } from '@/lib/platform/site/places/topics/ramadan-calendar';
import { SHABBAT_SLUG, shabbatReport, shabbatWeeks } from '@/lib/platform/site/places/topics/shabbat';
import { onDay } from '@/lib/platform/site/places/topics/sky-copy';
import type { TopicView } from './view';

const LIST = 'mt-3 flex flex-col gap-1.5 text-[14px] text-ink-2';

export const PRAYERS_VIEW: TopicView<PrayersData> = {
  icon: BookOpen,

  Body({ text, place, page: { data } }) {
    const { t } = text;
    const city = nameOf(place, t);
    const href = (slug: string) => localePath(t.locale, placePath(place, slug));
    const now = Date.now();
    return (
      <>
        {data.faiths.includes('muslim') && (() => {
          const next = nextPrayer(prayerToday(place, data.tz, now).days, now);
          const ramadan = nearestRamadan();
          return (
            <Section title={t('Islamic prayer times')}>
              {next && <p className="text-[15px] text-ink-1">{t('Next prayer: {prayer} {when}, {wait}.', { prayer: t(PRAYER_LABEL[next.prayer]), when: onDay(next.at, now, data.tz, t), wait: waitOf(next.at - now, t) })}</p>}
              <ul className={LIST}>
                <li><Link href={href('prayer-times')} rel={crawlRel(placeIndexed(place, 'prayer-times'))} className={TEXT_LINK}>{t('Prayer times in {city}', { city })}</Link></li>
                <li><Link href={href(ramadan.slug)} rel={crawlRel(placeIndexed(place, ramadan.slug))} className={TEXT_LINK}>{t('Ramadan {year} in {city}', { city, year: ramadanLabel(ramadan, t) })}</Link></li>
              </ul>
            </Section>
          );
        })()}
        {data.faiths.includes('jewish') && (() => {
          const [w] = shabbatWeeks(shabbatReport(place, data.tz, now));
          return (
            <Section title={t('Shabbat')}>
              {w.candles?.at != null && <p className="text-[15px] text-ink-1">{t('Candle lighting on {friday} at {time}.', { friday: longDay(w.friday, t), time: prayerClock(w.candles.at, data.tz, t) })}</p>}
              <ul className={LIST}>
                <li><Link href={href(SHABBAT_SLUG)} rel={crawlRel(placeIndexed(place, SHABBAT_SLUG))} className={TEXT_LINK}>{t('Shabbat times in {city}', { city })}</Link></li>
              </ul>
            </Section>
          );
        })()}
        <Section title={t('Holy days, every year')}>
          <ul className={LIST}>
            {/* The dates of the faiths the page shows, and no others. */}
            {data.faiths.includes('muslim') && <li><Link href={localePath(t.locale, '/ramadan')} className={TEXT_LINK}>{t('Ramadan dates')}</Link></li>}
            {data.faiths.includes('jewish') && <li><Link href={localePath(t.locale, '/jewish-holidays')} className={TEXT_LINK}>{t('Jewish holidays')}</Link></li>}
          </ul>
        </Section>
      </>
    );
  },
};

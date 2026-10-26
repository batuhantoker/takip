import { Flame } from 'lucide-react';
import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import type { Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { placeIndexed } from '@/lib/platform/site/places/pages';
import { placePath } from '@/lib/platform/site/places/paths';
import type { Place } from '@/lib/platform/site/places/place';
import { longDay, prayerClock, shortDate } from '@/lib/platform/site/places/topics/prayer-copy';
import { addDays } from '@/lib/platform/site/places/topics/prayer-hijri';
import { shabbatReport, shabbatWeeks, type ShabbatData, type ShabbatNow, type ShabbatReport } from '@/lib/platform/site/places/topics/shabbat';
import { hebrewDateIn, holyDayName } from '@/lib/platform/site/places/topics/shabbat-copy';
import type { ShabbatEvent } from '@/lib/platform/site/places/topics/shabbat-times';
import { latitudeOf, zoneName } from '@/lib/platform/site/places/topics/sky-copy';
import { longitudeOf } from '@/lib/platform/site/places/topics/sun-copy';
import { Notes } from '../parts/notes';
import type { TopicView } from './view';

const CELL = 'px-3 py-1.5 text-right whitespace-nowrap';
const HEAD = 'px-3 py-2 text-right font-medium';

const at = (e: ShabbatEvent | undefined, tz: string, t: Translate) => (e && e.at !== null ? prayerClock(e.at, tz, t) : '–');

function WeekTable({ r, tz, t }: { r: ShabbatReport; tz: string; t: Translate }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface-1">
      <table className="w-full text-[13px]">
        <thead className="bg-surface-2 text-ink-3">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">{t('Friday')}</th>
            <th scope="col" className={HEAD}>{t('Candle lighting')}</th>
            <th scope="col" className={HEAD}>{t('Havdalah')}</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">{t('Hebrew date')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {shabbatWeeks(r).map(w => (
            <tr key={w.friday}>
              <th scope="row" className="px-3 py-1.5 text-left font-normal whitespace-nowrap text-ink-2">{shortDate(w.friday, t, Number(r.today.slice(0, 4)))}</th>
              <td className={`${CELL} font-mono tabular-nums text-ink-1`}>{at(w.candles, tz, t)}</td>
              <td className={`${CELL} font-mono tabular-nums text-ink-1`}>{w.havdalah ? at(w.havdalah, tz, t) : `${t('a holiday follows')}*`}</td>
              <td className="px-3 py-1.5 whitespace-nowrap text-ink-3">{hebrewDateIn(addDays(w.friday, 1), t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HolidayTable({ events, tz, t }: { events: ShabbatEvent[]; tz: string; t: Translate }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface-1">
      <table className="w-full text-[13px]">
        <thead className="bg-surface-2 text-ink-3">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">{t('Evening of')}</th>
            {/* A festival, not the public-holiday pages' "Holiday" (a day off). */}
            <th scope="col" className="px-3 py-2 text-left font-medium">{t('shabbat|Holiday')}</th>
            <th scope="col" className={HEAD}>{t('Time')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {events.map(e => (
            <tr key={`${e.date}-${e.kind}`}>
              <th scope="row" className="px-3 py-1.5 text-left font-normal whitespace-nowrap text-ink-2">{shortDate(e.date, t)}</th>
              <td className="px-3 py-1.5 text-ink-1">
                {e.kind === 'candles' ? t('Candle lighting: {name}', { name: holyDayName(e.for, t) }) : t('Havdalah: {name} ends', { name: holyDayName(e.for, t) })}
              </td>
              <td className={`${CELL} font-mono tabular-nums text-ink-1`}>{at(e, tz, t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function notes(place: Place, r: ShabbatReport, t: Translate): string[] {
  return [
    t('Candles are lit {n} minutes before sunset, as Hebcal’s calendar gives it for {city}.', { n: r.minutes, city: nameOf(place, t) }),
    t('Havdalah, and the candles of a holiday’s second night, are at nightfall, when the Sun is 8.5° below the horizon and three small stars can be seen. Some communities wait longer, up to 72 minutes after sunset.'),
    r.israel
      ? t('In Israel each festival is kept for one day, so the second days kept abroad aren’t here.')
      : t('Outside Israel, Rosh Hashanah, Sukkot, Shemini Atzeret, Pesach and Shavuot are kept for two days, as here.'),
    t('Sunset is worked out from NOAA’s solar equations for {lat}, {lon}, at sea level; hills and buildings change what you see by a minute or two.', { lat: latitudeOf(place.at[1], t), lon: longitudeOf(place.at[0], t) }),
    t('Your synagogue’s calendar may differ; follow it.'),
  ];
}

/** The next week's candles and havdalah, as the header's box says them. */
function thisWeek(r: ShabbatReport, tz: string, t: Translate): string[] {
  const [w] = shabbatWeeks(r);
  const saturday = addDays(w.friday, 1);
  return [
    !w.havdalah
      ? t('This Shabbat: candle lighting on {friday} at {candles}; a holiday follows it.', { friday: longDay(w.friday, t), candles: at(w.candles, tz, t) })
      : w.havdalah.at === null
        ? t('This Shabbat: candle lighting on {friday} at {candles}; the night stays too light for a havdalah time.', { friday: longDay(w.friday, t), candles: at(w.candles, tz, t) })
        : t('This Shabbat: candle lighting on {friday} at {candles}, havdalah on {saturday} at {havdalah}.', { friday: longDay(w.friday, t), candles: at(w.candles, tz, t), saturday: longDay(saturday, t), havdalah: at(w.havdalah, tz, t) }),
    t('{date} in the Hebrew calendar.', { date: hebrewDateIn(saturday, t) }),
  ];
}

export const SHABBAT_VIEW: TopicView<ShabbatData, ShabbatNow> = {
  icon: Flame,

  Live({ text, place, page: { data }, live: { at: now, report } }) {
    const { t } = text;
    const next = report.events.find(e => e.kind === 'candles' && e.for.holiday && e.date >= report.today);
    return (
      <>
        {thisWeek(report, data.tz, t).map((line, i) => <p key={line} className={i ? undefined : 'text-[15px] text-ink-1'}>{line}</p>)}
        {next && <p>{t('Next holiday: {name}, candle lighting on {date} at {time}.', { name: holyDayName(next.for, t), date: longDay(next.date, t), time: at(next, data.tz, t) })}</p>}
        <p className="text-[13px] text-ink-3">{t('Times are {city} time ({zone}).', { city: nameOf(place, t), zone: zoneName(now, data.tz, t) })}</p>
      </>
    );
  },

  Body({ text, place, page: { data } }) {
    const { t } = text;
    const r = shabbatReport(place, data.tz);
    const city = nameOf(place, t);
    const holidays = r.events.filter(e => e.for.holiday && e.date >= r.today);
    return (
      <>
        <Section title={t('Candle lighting and havdalah for the next 12 weeks')}>
          <WeekTable r={r} tz={data.tz} t={t} />
          {shabbatWeeks(r).some(w => !w.havdalah) && <p className="mt-2 text-[13px] text-ink-3">{t('* Shabbat runs into a holiday: its candles are lit at nightfall, as below.')}</p>}
          {/* Hebcal gives no havdalah then either (Saint Petersburg, late June). */}
          {shabbatWeeks(r).some(w => w.havdalah?.at === null) && <p className="mt-2 text-[13px] text-ink-3">{t('– On these summer nights the Sun never gets 8.5° below the horizon, so there is no nightfall to give a havdalah time by.')}</p>}
          <p className="mt-3 text-[14px] text-ink-2">
            {t('Sunrise, sunset, twilight and day length:')}{' '}
            <Link href={localePath(t.locale, placePath(place, 'sun'))} rel={crawlRel(placeIndexed(place, 'sun'))} className={TEXT_LINK}>{t('Sunrise and sunset in {city}', { city })}</Link>
          </p>
          <p className="mt-1 text-[14px] text-ink-2">
            {t('Holidays and their dates, every year:')}{' '}
            <Link href={localePath(t.locale, '/jewish-holidays')} className={TEXT_LINK}>{t('Jewish holidays')}</Link>
          </p>
        </Section>
        {holidays.length > 0 && (
          <Section title={t('Holidays in the next 12 weeks')}>
            <HolidayTable events={holidays} tz={data.tz} t={t} />
          </Section>
        )}
        <Notes text={text} notes={notes(place, r, t)} layers={['day-night-map']} />
      </>
    );
  },
};

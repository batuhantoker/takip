import { Moon } from 'lucide-react';
import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import type { Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { placeIndexed } from '@/lib/platform/site/places/pages';
import { placePath } from '@/lib/platform/site/places/paths';
import { addDays } from '@/lib/platform/site/places/topics/prayer-hijri';
import { longDay, prayerClock, shortDay } from '@/lib/platform/site/places/topics/prayer-copy';
import type { PrayerDay } from '@/lib/platform/site/places/topics/prayer-times';
import { fastOf, imsakOf, ramadanLabel, ramadanReport, type RamadanData, type RamadanNow, type RamadanReport } from '@/lib/platform/site/places/topics/ramadan';
import { zoneName } from '@/lib/platform/site/places/topics/sky-copy';
import { localClock } from '@/lib/platform/site/places/topics/sky-time';
import { hoursOf } from '@/lib/platform/site/places/topics/sun-copy';
import { Notes } from '../parts/notes';
import { prayerNotes } from './lib/prayer-notes';
import type { TopicView } from './view';

const CELL = 'px-3 py-1.5 text-right whitespace-nowrap';
const HEAD = 'px-3 py-2 text-right font-medium';

function MonthTable({ r, tz, today, t }: { r: RamadanReport; tz: string; today: string; t: Translate }) {
  const clock = (ms: number) => prayerClock(ms, tz, t);
  const imsak = r.imsakBefore > 0;
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface-1">
      <table className="w-full text-[13px]">
        <thead className="bg-surface-2 text-ink-3">
          <tr>
            {/* The day of Ramadan, not the date: some languages' "Day" elsewhere reads as a date. */}
            <th scope="col" className="px-3 py-2 text-left font-medium">{t('ramadan|Day')}</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">{t('Date')}</th>
            {imsak && <th scope="col" className={HEAD}>{t('Imsak (sehri ends)')}</th>}
            <th scope="col" className={HEAD}>{imsak ? t('Fajr') : t('Fajr (sehri ends)')}</th>
            <th scope="col" className={HEAD}>{t('Iftar (Maghrib)')}</th>
            <th scope="col" className={HEAD}>{t('Isha, then tarawih')}</th>
            <th scope="col" className={HEAD}>{t('Fast')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line font-mono tabular-nums">
          {r.prayer.days.map((d, i) => (
            <tr key={d.date} aria-current={d.date === today ? 'date' : undefined} className={d.date === today ? 'bg-surface-2' : undefined}>
              <td className="px-3 py-1.5 text-left text-ink-2">{i + 1}</td>
              <th scope="row" className="px-3 py-1.5 text-left font-sans font-normal whitespace-nowrap text-ink-2">{shortDay(d.date, t)}{d.polar && '*'}</th>
              {imsak && <td className={`${CELL} text-ink-1`}>{clock(imsakOf(r, d))}{d.held.fajr && '*'}</td>}
              <td className={`${CELL} text-ink-1`}>{clock(d.times.fajr)}{d.held.fajr && '*'}</td>
              <td className={`${CELL} text-ink-1`}>{clock(d.times.maghrib)}</td>
              <td className={`${CELL} text-ink-1`}>{clock(d.times.isha)}{d.held.isha && '*'}</td>
              <td className={`${CELL} text-ink-2`}>{hoursOf(fastOf(r, d), t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function facts(r: RamadanReport, data: RamadanData, tz: string, t: Translate): string[] {
  const { span, prayer: { days } } = r;
  const year = ramadanLabel(data, t);
  const clock = (ms: number) => prayerClock(ms, tz, t);
  const pick = (better: (a: number, b: number) => boolean) => days.reduce((x, d) => (better(fastOf(r, d), fastOf(r, x)) ? d : x));
  const fast = (d: PrayerDay) => ({ length: hoursOf(fastOf(r, d), t), date: longDay(d.date, t), imsak: clock(imsakOf(r, d)), iftar: clock(d.times.maghrib) });
  const [first, last] = [days[0], days[days.length - 1]];
  // The 27th's night begins at the 26th's Maghrib.
  const qadr = days[25];
  return [
    t('Ramadan {year} runs from {start} to {end} in the Umm al-Qura calendar, {days} days. Where the month begins and ends with the sighting of the new moon, it may start or end a day earlier or later.', {
      year, start: longDay(span.start, t), end: longDay(span.end, t), days: span.days,
    }),
    t('The first tarawih is prayed after Isha on {date}, the evening before the first fast.', { date: longDay(addDays(span.start, -1), t) }),
    t('First iftar: {time} on {date}. Last iftar: {lastTime} on {lastDate}.', { time: clock(first.times.maghrib), date: longDay(first.date, t), lastTime: clock(last.times.maghrib), lastDate: longDay(last.date, t) }),
    t('Longest fast: {length} on {date}, from {imsak} to {iftar}.', fast(pick((a, b) => a > b))),
    t('Shortest fast: {length} on {date}, from {imsak} to {iftar}.', fast(pick((a, b) => a < b))),
    ...(qadr ? [t('Laylat al-Qadr, as most observe it, is the night before the 27th: from Maghrib on {date}, at {time}.', { date: longDay(qadr.date, t), time: clock(qadr.times.maghrib) })] : []),
    t('Eid al-Fitr: {date}.', { date: longDay(span.eid, t) }),
  ];
}

function imsakNote(r: RamadanReport, cc: string, t: Translate): string {
  if (r.imsakBefore > 0) return t('Imsak, when sehri ends, is {n} minutes before Fajr here, as Ramadan timetables in this country give it; the fast itself begins at Fajr.', { n: r.imsakBefore });
  // Diyanet's İmsak is the start of Fajr.
  if (cc === 'TR') return t('Diyanet’s imsak is the start of Fajr, so sehri ends at Fajr.');
  return t('Sehri ends at Fajr, when the fast begins; many timetables stop a few minutes earlier as a margin.');
}

function liveLine(n: RamadanNow, data: RamadanData, tz: string, t: Translate): string {
  const { report: r, today } = n;
  const year = ramadanLabel(data, t);
  const day = r.prayer.days.findIndex(d => d.date === today);
  if (day >= 0) {
    const d = r.prayer.days[day];
    return t('Today is day {day} of Ramadan: sehri ends at {imsak} and iftar is at {iftar}.', { day: day + 1, imsak: prayerClock(imsakOf(r, d), tz, t), iftar: prayerClock(d.times.maghrib, tz, t) });
  }
  if (today < r.span.start) {
    const left = Math.round((Date.parse(r.span.start) - Date.parse(today)) / 86_400_000);
    return t('Ramadan {year} begins in {n} days, on {date}.', { year, n: left, date: longDay(r.span.start, t) });
  }
  return t('Ramadan {year} ended on {date}, and Eid al-Fitr was on {eid}.', { year, date: longDay(r.span.end, t), eid: longDay(r.span.eid, t) });
}

export const RAMADAN_VIEW: TopicView<RamadanData, RamadanNow> = {
  icon: Moon,

  Live({ text, place, page: { data }, live }) {
    const { t } = text;
    return (
      <>
        <p className="text-[15px] text-ink-1">{liveLine(live, data, data.tz, t)}</p>
        <p className="text-[13px] text-ink-3">{t('Times are {city} time ({zone}).', { city: nameOf(place, t), zone: zoneName(live.at, data.tz, t) })}</p>
      </>
    );
  },

  Body({ text, place, page: { data } }) {
    const { t } = text;
    const r = ramadanReport(place, data.tz, data.hijriYear);
    const city = nameOf(place, t);
    const year = ramadanLabel(data, t);
    const today = localClock(Date.now(), data.tz).date;
    return (
      <>
        <Section title={t('Ramadan {year} at a glance', { year })}>
          <ul className="flex flex-col gap-2 text-[14px] leading-relaxed text-ink-2">{facts(r, data, data.tz, t).map(f => <li key={f}>{f}</li>)}</ul>
          <p className="mt-3 text-[14px] text-ink-2">
            {t('Fajr, Dhuhr, Asr, Maghrib and Isha today:')}{' '}
            <Link href={localePath(t.locale, placePath(place, 'prayer-times'))} rel={crawlRel(placeIndexed(place, 'prayer-times'))} className={TEXT_LINK}>{t('Prayer times in {city}', { city })}</Link>
          </p>
          <p className="mt-1 text-[14px] text-ink-2">
            {t('When Ramadan begins and ends, every year:')}{' '}
            <Link href={localePath(t.locale, '/ramadan')} className={TEXT_LINK}>{t('Ramadan dates')}</Link>
          </p>
        </Section>
        <Section title={t('Ramadan {year} timetable for {city}', { year, city })}>
          <p className="mb-3 text-[14px] text-ink-2">{t('Sehri and iftar times in {city} for each day of the month, in local time, with how long each fast lasts.', { city })}</p>
          <MonthTable r={r} tz={data.tz} today={today} t={t} />
        </Section>
        <Notes text={text} notes={prayerNotes(place, r.prayer, 'ramadan', t, [imsakNote(r, place.cc, t)])} layers={['day-night-map']} />
      </>
    );
  },
};

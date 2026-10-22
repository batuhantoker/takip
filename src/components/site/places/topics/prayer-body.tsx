import { MoonStar } from 'lucide-react';
import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import type { Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { placePath } from '@/lib/platform/site/places/paths';
import { kaabaKm, prayerToday, type PrayerData, type PrayerNow } from '@/lib/platform/site/places/topics/prayer';
import { AT_THE_KAABA_KM, compassOf, degreesOf, hijriIn, longDay, PRAYER_LABEL, prayerClock, shortDay, waitOf } from '@/lib/platform/site/places/topics/prayer-copy';
import { RAMADAN, ramadanNear } from '@/lib/platform/site/places/topics/prayer-hijri';
import { PRAYERS, qiblaOf, type PrayerDay, type PrayerReport } from '@/lib/platform/site/places/topics/prayer-times';
import { ramadanLabel } from '@/lib/platform/site/places/topics/ramadan';
import { nearestRamadan } from '@/lib/platform/site/places/topics/ramadan-calendar';
import { onDay, zoneName } from '@/lib/platform/site/places/topics/sky-copy';
import { Notes } from '../parts/notes';
import { prayerNotes } from './lib/prayer-notes';
import type { TopicView } from './view';

const CELL = 'px-3 py-1.5 text-right whitespace-nowrap';
const HEAD = 'px-3 py-2 text-right font-medium';

/** Standard and Hanafi Asr, whichever the method gives as `times.asr`. */
const asrPair = (d: PrayerDay, r: PrayerReport) => (r.method.asr === 'hanafi' ? [d.asrOther, d.times.asr] : [d.times.asr, d.asrOther]);

function TodayTable({ r, tz, t }: { r: PrayerReport; tz: string; t: Translate }) {
  const d = r.days[0];
  const [standard, hanafi] = asrPair(d, r);
  const main = <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-3">{t('main time')}</span>;
  const rows: [string, number, boolean, boolean][] = [
    [t('Fajr'), d.times.fajr, d.held.fajr || d.polar, false],
    // Prayer timetables have their own word for it in some languages (Diyanet's "Güneş").
    [t('prayer|Sunrise'), d.times.sunrise, d.polar, false],
    [t('Dhuhr'), d.times.dhuhr, d.polar, false],
    [t('Asr, standard (Shafi‘i, Maliki and Hanbali)'), standard, d.polar, r.method.asr === 'standard'],
    [t('Asr, Hanafi'), hanafi, d.polar, r.method.asr === 'hanafi'],
    [t('Maghrib'), d.times.maghrib, d.polar, false],
    [t('Isha'), d.times.isha, d.held.isha || d.polar, false],
  ];
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface-1">
      <table className="w-full text-[14px]">
        <tbody className="divide-y divide-line">
          {rows.map(([label, at, marked, isMain]) => (
            <tr key={label}>
              <th scope="row" className="px-4 py-2 text-left font-normal text-ink-2">{label}{isMain && main}</th>
              <td className="px-4 py-2 text-right font-mono tabular-nums text-ink-1 whitespace-nowrap">{prayerClock(at, tz, t)}{marked && '*'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthTable({ r, tz, t }: { r: PrayerReport; tz: string; t: Translate }) {
  const ramadan = r.days.some(d => d.hijri.month === RAMADAN);
  const keys = PRAYERS;
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface-1">
      <table className="w-full text-[13px]">
        <thead className="bg-surface-2 text-ink-3">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">{t('Date')}</th>
            {ramadan && <th scope="col" className={HEAD}>{t('Ramadan')}</th>}
            {keys.map(k => <th key={k} scope="col" className={HEAD}>{t(PRAYER_LABEL[k])}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line font-mono tabular-nums">
          {r.days.map(d => (
            <tr key={d.date}>
              <th scope="row" className="px-3 py-1.5 text-left font-sans font-normal whitespace-nowrap text-ink-2">{shortDay(d.date, t)}{d.polar && '*'}</th>
              {ramadan && <td className={`${CELL} text-ink-2`}>{d.hijri.month === RAMADAN ? d.hijri.day : ''}</td>}
              {keys.map(k => (
                <td key={k} className={`${CELL} text-ink-1`}>
                  {prayerClock(d.times[k], tz, t)}{((k === 'fajr' && d.held.fajr) || (k === 'isha' && d.held.isha)) && '*'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ramadanLine(r: PrayerReport, tz: string, t: Translate): string | null {
  const today = r.days[0];
  const near = ramadanNear(today.date);
  if (!near) return null;
  if (near.kind === 'during') {
    return t('Ramadan {year}, day {day}: suhur ends at Fajr (imsak), {fajr}, and iftar is at Maghrib, {maghrib}.', {
      year: String(near.year), day: near.day, fajr: prayerClock(today.times.fajr, tz, t), maghrib: prayerClock(today.times.maghrib, tz, t),
    });
  }
  return t('Ramadan {year} begins on {date} in the Umm al-Qura calendar; where it begins with the sighting of the new moon, it may start a day earlier or later.', { year: String(near.year), date: longDay(near.starts, t) });
}

export const PRAYER_VIEW: TopicView<PrayerData, PrayerNow> = {
  icon: MoonStar,

  Live({ text, place, page: { data }, live: { at, report, next } }) {
    const { t } = text;
    const ramadan = ramadanLine(report, data.tz, t);
    return (
      <>
        {next && (
          <p className="text-[15px] text-ink-1">{t('Next prayer: {prayer} {when}, {wait}.', {
            prayer: t(PRAYER_LABEL[next.prayer]), when: onDay(next.at, at, data.tz, t), wait: waitOf(next.at - at, t),
          })}</p>
        )}
        <p>{t('Today is {date} in the Umm al-Qura calendar.', { date: hijriIn(report.days[0].date, t) })}</p>
        {ramadan && <p>{ramadan}</p>}
        <p className="text-[13px] text-ink-3">{t('Times are {city} time ({zone}).', { city: nameOf(place, t), zone: zoneName(at, data.tz, t) })}</p>
      </>
    );
  },

  Body({ text, place, page: { data } }) {
    const { t } = text;
    const r = prayerToday(place, data.tz);
    const city = nameOf(place, t);
    const qibla = qiblaOf(place.at[1], place.at[0]);
    const last = r.days[r.days.length - 1];
    const ramadan = nearestRamadan();
    return (
      <>
        <Section title={t('Prayer times today, {day}', { day: longDay(r.days[0].date, t) })}>
          <TodayTable r={r} tz={data.tz} t={t} />
          <p className="mt-2 text-[13px] text-ink-3">{t('Salah times in {city}: each is when that prayer’s time begins and the azan is called.', { city })}</p>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
            {t('Asr begins when a shadow is as long as the thing casting it, beyond its noon shadow, in the Shafi‘i, Maliki and Hanbali schools, and twice as long in the Hanafi school.')}{' '}
            {r.method.asr === 'hanafi'
              ? t('{method} timetables give the Hanafi time, as the timetable below does.', { method: t(r.method.short) })
              : t('{method} timetables give the standard time, as the timetable below does.', { method: t(r.method.short) })}
          </p>
          <p className="mt-3 text-[14px] text-ink-2">
            {t('Sunrise, sunset, twilight and day length:')}{' '}
            <Link href={localePath(t.locale, placePath(place, 'sun'))} className={TEXT_LINK}>{t('Sunrise and sunset in {city}', { city })}</Link>
          </p>
          <p className="mt-1 text-[14px] text-ink-2">
            {t('Sehri and iftar for each day of the month:')}{' '}
            <Link href={localePath(t.locale, placePath(place, ramadan.slug))} className={TEXT_LINK}>{t('Ramadan {year} in {city}', { city, year: ramadanLabel(ramadan, t) })}</Link>
          </p>
          <p className="mt-1 text-[14px] text-ink-2">
            {t('When Ramadan begins and ends, every year:')}{' '}
            <Link href={localePath(t.locale, '/ramadan')} className={TEXT_LINK}>{t('Ramadan dates')}</Link>
          </p>
        </Section>
        <Section title={t('Qibla direction from {city}', { city })}>
          {qibla.km < AT_THE_KAABA_KM ? (
            <p className="text-[15px] leading-relaxed text-ink-1">{t('The Kaaba stands in the Masjid al-Haram in {city}; around it, the rows of worshippers face it from every side.', { city })}</p>
          ) : (
            <>
              <p className="text-[15px] leading-relaxed text-ink-1">{t('{bearing} from true north, {compass}, along the shortest path over the globe to the Kaaba in Mecca, {km, distance} away.', {
                bearing: degreesOf(qibla.bearing, t), compass: compassOf(qibla.bearing, t), km: kaabaKm(qibla.km),
              })}</p>
              <p className="mt-2 text-[13px] text-ink-3">{t('A magnetic compass points to magnetic north, a few degrees off true north in most places; set a phone’s compass to true north to read the bearing directly.')}</p>
            </>
          )}
        </Section>
        <Section title={t('Prayer timetable for the next 30 days')}>
          <p className="mb-3 text-[14px] text-ink-2">{t('Namaz times in {city} from {from} to {to}, in local time.', { city, from: longDay(r.days[0].date, t), to: longDay(last.date, t) })}</p>
          <MonthTable r={r} tz={data.tz} t={t} />
        </Section>
        <Notes text={text} notes={prayerNotes(place, r, 'next', t)} layers={['day-night-map']} />
      </>
    );
  },
};

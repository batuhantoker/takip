import { Sunrise } from 'lucide-react';
import Link from 'next/link';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { nameOf, placeName, wordingOf } from '@/lib/platform/site/places/copy/format';
import { placeIndexed } from '@/lib/platform/site/places/pages';
import { placePath } from '@/lib/platform/site/places/paths';
import type { Place } from '@/lib/platform/site/places/place';
import { latitudeOf, dayIn, zoneName } from '@/lib/platform/site/places/topics/sky-copy';
import { faithShown } from '@/lib/platform/site/places/topics/faith-reach';
import { sunToday, type SunData } from '@/lib/platform/site/places/topics/sun';
import { changeOf, dateIn, hoursOf, longitudeOf, sunAt, timeOn, twilightAt } from '@/lib/platform/site/places/topics/sun-copy';
import type { SunDate, SunReport } from '@/lib/platform/site/places/topics/sun-report';
import { dayLength, type Crossing } from '@/lib/platform/site/places/topics/sun-times';
import { Notes } from '../parts/notes';
import type { TopicView } from './view';

const CELL = 'px-4 py-1.5 text-right whitespace-nowrap';

/** Golden hour runs from sunrise to the Sun at 6°, and from 6° down to sunset. */
function golden(r: SunReport, tz: string, t: Translate): [string, string] {
  const { rise, set, golden: [up, down] } = r.today;
  if (typeof rise !== 'number' || typeof set !== 'number') return ['–', '–'];
  if (up === 'below') return [t('all day'), t('all day')];
  if (typeof up !== 'number' || typeof down !== 'number') return ['–', '–'];
  const at = (ms: number) => timeOn(ms, r.date, tz, t);
  return [`${at(rise)}–${at(up)}`, `${at(down)}–${at(set)}`];
}

function TodayTable({ r, tz, t }: { r: SunReport; tz: string; t: Translate }) {
  const d = r.today;
  const pair = ([a, b]: [Crossing, Crossing]) => [twilightAt(a, r.date, tz, t), twilightAt(b, r.date, tz, t)];
  const rows: [string, string[]][] = [
    [t('Astronomical twilight'), pair(d.astronomical)],
    [t('Nautical twilight'), pair(d.nautical)],
    [t('Civil twilight'), pair(d.civil)],
    [t('Sunrise and sunset'), [sunAt(d.rise, r.date, tz, t), sunAt(d.set, r.date, tz, t)]],
    [t('Golden hour'), golden(r, tz, t)],
  ];
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface-1">
      <table className="w-full text-[13px]">
        <thead className="bg-surface-2 text-ink-3">
          <tr>
            <th scope="col" className="px-4 py-2 text-left font-medium"><span className="sr-only">{t('Today')}</span></th>
            <th scope="col" className="px-4 py-2 text-right font-medium">{t('Morning')}</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">{t('Evening')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(([label, [am, pm]]) => (
            <tr key={label}>
              <th scope="row" className="px-4 py-1.5 text-left font-normal text-ink-2">{label}</th>
              <td className={`${CELL} font-mono tabular-nums text-ink-1`}>{am}</td>
              <td className={`${CELL} font-mono tabular-nums text-ink-1`}>{pm}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthTable({ rows, tz, t }: { rows: SunDate[]; tz: string; t: Translate }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface-1">
      <table className="w-full text-[13px]">
        <thead className="bg-surface-2 text-ink-3">
          <tr>
            <th scope="col" className="px-4 py-2 text-left font-medium">{t('Date')}</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">{t('Sunrise')}</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">{t('Sunset')}</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">{t('Day length')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line font-mono tabular-nums">
          {rows.map(m => (
            <tr key={m.date}>
              <th scope="row" className="px-4 py-1.5 text-left font-sans font-normal text-ink-2">{dateIn(m.date, t)}</th>
              <td className={`${CELL} text-ink-1`}>{sunAt(m.rise, m.date, tz, t)}</td>
              <td className={`${CELL} text-ink-1`}>{sunAt(m.set, m.date, tz, t)}</td>
              <td className={`${CELL} text-ink-2`}>{hoursOf(m.length, t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function yearFacts(r: SunReport, tz: string, t: Translate): string[] {
  const day = (d: SunDate) => ({
    date: dateIn(d.date, t), length: hoursOf(d.length, t), rise: sunAt(d.rise, d.date, tz, t), set: sunAt(d.set, d.date, tz, t),
  });
  return [
    ...(r.midnightSun ? [t('Midnight sun: the Sun doesn’t set from {from} to {to}, {days} days.', { from: dateIn(r.midnightSun.from, t), to: dateIn(r.midnightSun.to, t), days: r.midnightSun.days })] : []),
    ...(r.longest ? [t('Longest day: {date}, {length}, from sunrise at {rise} to sunset at {set}.', day(r.longest))] : []),
    ...(r.shortest ? [t('Shortest day: {date}, {length}, from sunrise at {rise} to sunset at {set}.', day(r.shortest))] : []),
    ...(r.polarNight ? [t('Polar night: the Sun doesn’t rise from {from} to {to}, {days} days.', { from: dateIn(r.polarNight.from, t), to: dateIn(r.polarNight.to, t), days: r.polarNight.days })] : []),
  ];
}

function noonLine(r: SunReport, tz: string, t: Translate): string {
  const time = timeOn(r.today.noon, r.date, tz, t);
  const deg = Math.round(Math.abs(r.today.noonElevation));
  return r.today.noonElevation >= 0
    ? t('Solar noon at {time}, with the Sun {deg}° above the horizon.', { time, deg })
    : t('Solar noon at {time}; the Sun stays {deg}° below the horizon.', { time, deg });
}

const RISE = [
  msg('{day} in {city}: sunrise at {rise}, sunset at {set}.'),
  msg('In {city} on {day}, the Sun rises at {rise} and sets at {set}.'),
  msg('The Sun is up from {rise} to {set} in {city} on {day}.'),
];

function riseLine(r: SunReport, tz: string, place: Place, t: Translate): string {
  const { rise, set } = r.today;
  const day = dayIn(r.at, tz, t);
  const city = placeName(place, t);
  if (rise === 'above') return t('{day} in {city}: the Sun doesn’t set today, the midnight sun.', { day, city });
  if (rise === 'below') return t('{day} in {city}: the Sun doesn’t rise today, the polar night.', { day, city });
  return t(wordingOf(place, 'rise', RISE), { day, city, rise: sunAt(rise, r.date, tz, t), set: sunAt(set, r.date, tz, t) });
}

export const SUN_VIEW: TopicView<SunData, SunReport> = {
  icon: Sunrise,

  Live({ text, place, page: { data }, live: r }) {
    const { t } = text;
    const length = dayLength(r.today);
    return (
      <>
        <p className="text-[15px] text-ink-1">{riseLine(r, data.tz, place, t)}</p>
        {typeof r.today.rise === 'number' && (
          <p>{r.change === null
            ? t('Day length {length}.', { length: hoursOf(length, t) })
            : t('Day length {length}, {change}.', { length: hoursOf(length, t), change: changeOf(r.change, t) })}</p>
        )}
        <p>{noonLine(r, data.tz, t)}</p>
        <p className="text-[13px] text-ink-3">{t('Times are {city} time ({zone}).', { city: nameOf(place, t), zone: zoneName(r.at, data.tz, t) })}</p>
      </>
    );
  },

  Body({ text, place, page: { data } }) {
    const { t } = text;
    const r = sunToday(place, data.tz);
    const city = nameOf(place, t);
    const facts = yearFacts(r, data.tz, t);
    return (
      <>
        <Section title={t('Twilight and golden hour today')}>
          <TodayTable r={r} tz={data.tz} t={t} />
          <p className="mt-2 text-[13px] text-ink-3">{t('Each twilight begins at the morning time and ends at the evening one.')}</p>
          {/* Only where Islam is the country's majority faith: faith-reach.ts. */}
          {faithShown(place).includes('muslim') && (
            <p className="mt-3 text-[14px] text-ink-2">
              {t('Fajr, Dhuhr, Asr, Maghrib and Isha:')}{' '}
              <Link href={localePath(t.locale, placePath(place, 'prayer-times'))} rel={crawlRel(placeIndexed(place, 'prayer-times'))} className={TEXT_LINK}>{t('Prayer times in {city}', { city })}</Link>
            </p>
          )}
        </Section>
        {facts.length > 0 && (
          <Section title={t('The year in {city}', { city })}>
            <ul className="flex flex-col gap-2 text-[14px] leading-relaxed text-ink-2">{facts.map(f => <li key={f}>{f}</li>)}</ul>
          </Section>
        )}
        <Section title={t('Sunrise and sunset on the 21st of each month, {year}', { year: r.date.slice(0, 4) })}>
          <MonthTable rows={r.months} tz={data.tz} t={t} />
        </Section>
        <Notes text={text} notes={notes(place, t)} layers={['day-night-map', 'night-sky']} />
      </>
    );
  },
};

function notes(place: Place, t: Translate): string[] {
  return [
    t(wordingOf(place, 'note-horizon', [msg('Sunrise and sunset are when the top of the Sun meets a level horizon, allowing for the usual bending of light by the air. Hills, buildings and height shift what you see by a few minutes.'), msg('Sunrise and sunset mark the moment the Sun’s upper edge touches a level horizon, with the air’s usual bending of light allowed for. Hills, buildings and altitude move what you see by a few minutes.')])),
    t('Civil, nautical and astronomical twilight end when the Sun is 6°, 12° and 18° below the horizon. Golden hour here is the photographers’ usual definition: the Sun less than 6° above it.'),
    t('Worked out when the page loads from NOAA’s solar equations, for {lat}, {lon}, and accurate to about a minute.', { lat: latitudeOf(place.at[1], t), lon: longitudeOf(place.at[0], t) }),
  ];
}

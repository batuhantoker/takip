import { msg, type Translate } from '@/lib/core/i18n/translator';
import { instant, type Spoken } from '../../clock';
import { AURORA_NEAR_KM, type AuroraReport } from './aurora-now';
import { clockIn, compassWord, dayIn, onDay } from './sky-copy';
import { localClock } from './sky-time';

/**
 * What an aurora page says right now, sentence by sentence from NOAA's numbers for the place and its darkness
 * (aurora-now.ts lists the cases). "Now" and "dark from", never "tonight": the nowcast looks 30 minutes ahead.
 */

const pct = (n: number, t: Translate) => (n < 5 ? t('under 5%') : t('{n}%', { n }));

function darkUntil(r: AuroraReport, t: Translate): string {
  const end = r.darkness.darkUntil;
  if (end == null) return t('It stays dark for the next two days.');
  return r.clock.darkUntil?.date === localClock(r.now, r.tz).date
    ? t('It is dark until {time}.', { time: clockIn(end, r.tz, t) })
    : t('It is dark until {when}.', { when: onDay(end, r.now, r.tz, t) });
}

function darkness(r: AuroraReport, city: string, t: Translate): string {
  const d = r.darkness;
  if (d.state === 'dark') return darkUntil(r, t);
  if (d.darkFrom == null) {
    return d.darkAgain == null
      ? t('The sky over {city} doesn’t get dark enough for the aurora at this time of year.', { city })
      : t('The sky over {city} doesn’t get dark enough for the aurora again until about {day}.', { city, day: dayIn(d.darkAgain, r.tz, t) });
  }
  const when = onDay(d.darkFrom, r.now, r.tz, t);
  return d.state === 'twilight'
    ? t('It is twilight in {city}, so only a bright aurora would show; it is fully dark {when}.', { city, when })
    : t('It is too light in {city} to see the aurora; it gets dark {when}.', { city, when });
}

/** The live lines, in order. */
export function auroraLines(r: AuroraReport, city: string, t: Translate): string[] {
  const here = r.here ?? 0;
  switch (r.case) {
    case 'unavailable':
      return [t('NOAA’s aurora nowcast isn’t available right now, so there is no chance to give for {city}.', { city }), darkness(r, city, t)];
    case 'no-dark':
      return [darkness(r, city, t)];
    case 'light':
      return [
        darkness(r, city, t),
        t('NOAA’s model gives {pct} overhead right now. It looks only 30 minutes ahead, so check again once it is dark.', { pct: pct(here, t) }),
      ];
    case 'overhead':
      return [
        t('NOAA’s model gives a {pct} chance of aurora overhead in {city} right now.', { pct: pct(here, t), city }),
        darkUntil(r, t),
        t('With a clear sky it is worth going out, away from street lights.'),
      ];
    case 'horizon': {
      const pole = compassWord(r.nearby!.toward, t);
      return [
        t('NOAA’s model gives {here} overhead in {city} right now, but {near} about {km, radius} to the {dir}.', { here: pct(here, t), city, near: pct(r.nearby!.pct, t), km: r.nearby!.km, dir: pole }),
        t('With a clear sky and an open view to the {dir}, it may show there, low down.', { dir: pole }),
        darkUntil(r, t),
      ];
    }
    case 'quiet': {
      const near = r.nearby?.pct ?? 0;
      return [
        near > here
          ? t('NOAA’s model gives {here} overhead in {city} right now, and no more than {near} within {km, radius}: little chance of seeing it.', { here: pct(here, t), near: pct(near, t), city, km: AURORA_NEAR_KM })
          : t('NOAA’s model gives {here} overhead in {city} right now, and nothing more within {km, radius}: little chance of seeing it.', { here: pct(here, t), city, km: AURORA_NEAR_KM }),
        ...(r.worldMax != null && r.worldMax < 20 ? [t('It is quiet everywhere: the highest chance anywhere on Earth is {n}%.', { n: r.worldMax })] : []),
        darkUntil(r, t),
      ];
    }
  }
}

const NOWCAST = msg('NOAA SWPC’s OVATION nowcast for {time}. It ignores cloud and moonlight.');

/** Where the numbers come from, for the foot of the box. */
export function nowcastLine(r: AuroraReport, t: Translate): Spoken | null {
  const at = r.forecastAt ? Date.parse(r.forecastAt) : NaN;
  if (!Number.isFinite(at)) return null;
  return t.parts(NOWCAST, { time: instant(at) }) as Spoken;
}

/**
 * A common rule of thumb: the aurora's edge reaches about 66.5° − 2.05 × Kp of magnetic latitude. Rough, and only
 * said as such; null where even Kp 9 falls short.
 */
export function kpToReach(mlat: number): number | null {
  const kp = (66.5 - Math.abs(mlat)) / 2.05;
  return kp > 9 ? null : Math.max(0, Math.ceil(kp));
}

import type { Translate } from '@/lib/core/i18n/translator';
import { ISS_LOOKAHEAD_DAYS, type IssPass, type IssReport } from './iss-passes';
import { clockIn, compassWord, dayIn, skyWhen } from './sky-copy';

/**
 * What an ISS page says about the passes it worked out, sentence by sentence from the numbers (iss-passes.ts lists
 * the cases). Nothing here is the same on two cities' pages unless their passes are.
 */

const minutes = (p: IssPass) => p.minutes ?? 1;

/** How the next visible pass crosses the sky: a high one, a low one, or in between. */
function crossing(p: IssPass, t: Translate): string {
  const vars = { from: compassWord(p.from, t), to: compassWord(p.to ?? p.from, t), deg: p.maxElevation, n: minutes(p) };
  if (p.maxElevation >= 70) return t('It rises in the {from}, climbs almost overhead to {deg}° and sets in the {to} {n, plural, one {# minute} other {# minutes}} later.', vars);
  if (p.maxElevation < 20) return t('It stays low: it rises in the {from}, reaches {deg}° and sets in the {to} {n, plural, one {# minute} other {# minutes}} later, so look for a clear view that way.', vars);
  return t('It rises in the {from}, climbs to {deg}° and sets in the {to} {n, plural, one {# minute} other {# minutes}} later.', vars);
}

function later(r: IssReport, t: Translate): string {
  return r.later
    ? t('The next visible pass is expected {when}, up to {deg}°; that far ahead the time can shift by minutes.', { when: skyWhen(r.later.rise, r.now, r.tz, t), deg: r.later.maxElevation })
    : t('None is expected to be visible in the next {days} days either.', { days: ISS_LOOKAHEAD_DAYS });
}

/** The live lines, in order; [] for the cases that give no times (never, stale, unavailable). */
export function issLines(r: IssReport, city: string, t: Translate): string[] {
  switch (r.case) {
    case 'visible': {
      const next = r.next!;
      const lines = [t('Next visible pass: {when}.', { when: skyWhen(next.rise, r.now, r.tz, t) }), crossing(next, t)];
      lines.push(t('{n, plural, one {It is the only visible pass over {city} in the next three days.} other {There are # visible passes over {city} in the next three days.}}', { n: r.visible.length, city }));
      if (r.highest && r.highest !== next && r.highest.maxElevation >= next.maxElevation + 5) {
        lines.push(t('The highest is {when}, at {deg}°.', { when: skyWhen(r.highest.rise, r.now, r.tz, t), deg: r.highest.maxElevation }));
      }
      return lines;
    }
    case 'unseen':
      return [
        t('The station crosses the sky over {city} {n, plural, one {once} other {# times}} in the next three days, but each time in daylight or in Earth’s shadow, so none of them can be seen.', { city, n: r.passes.length }),
        later(r, t),
      ];
    case 'none':
      return [t('The station doesn’t climb above 10° over {city} in the next three days.', { city }), later(r, t)];
    default:
      return [];
  }
}

/** One visible pass as a row: "Tuesday 20 October", "05:42–05:49", "south-west → east, up to 63°". */
export function passRow(p: IssPass, tz: string, t: Translate) {
  return {
    day: dayIn(p.rise, tz, t),
    time: p.set == null ? clockIn(p.rise, tz, t) : t('{start}–{end}', { start: clockIn(p.rise, tz, t), end: clockIn(p.set, tz, t) }),
    path: t('{from} to {to}, up to {deg}°', { from: compassWord(p.from, t), to: compassWord(p.to ?? p.from, t), deg: p.maxElevation }),
  };
}

/** Where the times come from, for the foot of the list. */
export function elementsLine(r: IssReport, t: Translate): string | null {
  if (r.epoch == null) return null;
  const when = new Intl.DateTimeFormat(t.intl, { timeZone: 'UTC', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(r.epoch);
  return t('Predicted from the orbital elements of {when} UTC. A pass needs a clear sky, and the times move when the station boosts its orbit.', { when });
}

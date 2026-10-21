import type { Translate } from '@/lib/core/i18n/translator';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import type { Place } from '@/lib/platform/site/places/place';
import { methodRules } from '@/lib/platform/site/places/topics/prayer-copy';
import { alternativeFor, roundsUp } from '@/lib/platform/site/places/topics/prayer-methods';
import type { PrayerReport } from '@/lib/platform/site/places/topics/prayer-times';
import { latitudeOf } from '@/lib/platform/site/places/topics/sky-copy';
import { longitudeOf } from '@/lib/platform/site/places/topics/sun-copy';

/** What the prayer-times and Ramadan pages say about their method, for the days `r` holds: the next 30 or Ramadan's. */

type Span = 'next' | 'ramadan';

function highLatitudeNotes(place: Place, r: PrayerReport, span: Span, t: Translate): string[] {
  const lat = latitudeOf(place.at[1], t);
  const held = r.days.filter(d => d.held.fajr || d.held.isha).length;
  const polar = r.days.filter(d => d.polar).length;
  const days = r.days.length;
  return [
    ...(r.rule === 'seventh' && held > 0
      ? [span === 'next'
        ? t('At {lat}, twilight lasts long: on {n} of the next 30 days Fajr is kept no earlier than the last seventh of the night, or Isha no later than the first seventh, the usual rule beyond 48°. Those times are marked *.', { lat, n: held })
        : t('At {lat}, twilight lasts long: on {n} of Ramadan’s {days} days Fajr is kept no earlier than the last seventh of the night, or Isha no later than the first seventh, the usual rule beyond 48°. Those times are marked *.', { lat, n: held, days })]
      : []),
    ...(r.rule === 'moonsighting'
      ? [Math.abs(place.at[1]) >= 55
        ? t('At {lat}, the Moonsighting Committee puts Fajr a seventh of the night before sunrise and Isha a seventh after sunset, as it does from 55° on.', { lat })
        : t('Where twilight runs long, as in summer here, the Moonsighting Committee keeps Fajr and Isha within its own seasonal limits.')]
      : []),
    ...(polar > 0
      ? [span === 'next'
        ? t('On {n} of the next 30 days the Sun doesn’t rise or doesn’t set in {city}. Those days, marked *, take their times from the nearest latitude where it does (aqrab al-bilad), as moonsighting.com does.', { n: polar, city: nameOf(place, t) })
        : t('On {n} of Ramadan’s {days} days the Sun doesn’t rise or doesn’t set in {city}. Those days, marked *, take their times from the nearest latitude where it does (aqrab al-bilad), as moonsighting.com does.', { n: polar, days, city: nameOf(place, t) })]
      : []),
  ];
}

/** The method and its rules first, then the place's own exceptions; `extra` goes before the closing caveats. */
export function prayerNotes(place: Place, r: PrayerReport, span: Span, t: Translate, extra: string[] = []): string[] {
  const alt = alternativeFor(place.cc);
  const at = { lat: latitudeOf(place.at[1], t), lon: longitudeOf(place.at[0], t) };
  return [
    t('Times follow the {method} method: {rules}.', { method: t(r.method.name), rules: methodRules(r.method, t) }),
    ...(r.method.id === 'ummAlQura' ? [t('In Ramadan, Umm al-Qura puts Isha two hours after Maghrib rather than 90 minutes, and so do the times here.')] : []),
    ...(alt ? [t(alt)] : []),
    ...highLatitudeNotes(place, r, span, t),
    ...extra,
    t('Hijri dates follow the Umm al-Qura calendar. Where a month begins with the sighting of the new moon, it can start a day earlier or later.'),
    roundsUp(r.method)
      ? t('Worked out when the page loads for {lat}, {lon} with the adhan library, from Jean Meeus’s astronomical equations, and rounded up to the minute.', at)
      : t('Worked out when the page loads for {lat}, {lon} with the adhan library, from Jean Meeus’s astronomical equations, and rounded to the minute.', at),
    t('Your local mosque may set its own times; follow it.'),
  ];
}

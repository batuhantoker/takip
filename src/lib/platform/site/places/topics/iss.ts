import { msg, type Translate } from '@/lib/core/i18n/translator';
import { DESCRIPTION_RANGE, fit, nameOf, placeFirst, placeName, TITLE_MAX, wordingOf } from '../copy/format';
import type { Place } from '../place';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import { ISS_NORAD, issElementsNow, issReport, type IssReport } from './iss-passes';
import { latitudeOf } from './sky-copy';
import type { IssRow } from './sky-data';
import { SKY_RULES, issBestElevation } from './sky-rules';

/**
 * When the International Space Station can be seen from a place, at /city/<place>/iss: its next passes in the
 * place's own time, worked out when the page renders from the latest orbital elements (iss-passes.ts). Every city
 * has a page, since "it never climbs above 10° here" is a true answer; indexed by sky-rules.ts's bar.
 */

export interface IssData {
  tz: string;
  lat: number;
  /** The highest it can ever climb here, whole degrees. */
  best: number;
}

/** The passes, and when they were worked out for the "as of" stamp. */
export interface IssLive { at: number; report: IssReport }

/** Which horizon it stays over where it can't pass overhead: the one toward the equator. */
const side = (lat: number) => (lat >= 0 ? 'south' : 'north');

// Passes for one place change slowly; five minutes keeps a crawl from recomputing them per request.
const MEMO_MS = 5 * 60_000;
const memo = new Map<number, IssLive>();

async function passesNow(place: Place, data: IssData): Promise<IssLive | null> {
  const now = Date.now();
  const held = memo.get(place.id);
  if (held && now - held.at < MEMO_MS) return held;
  const report = issReport(await issElementsNow(), { lat: place.at[1], lng: place.at[0], tz: data.tz }, now);
  if (report.case === 'unavailable' || report.case === 'stale' || report.case === 'never') return null;
  if (memo.size > 2000) memo.clear();
  const live = { at: now, report };
  memo.set(place.id, live);
  return live;
}

export const ISS: PlaceTopic<IssData, IssLive> = {
  id: 'iss',
  label: msg('ISS passes'),
  inline: msg('ISS sightings'),
  kinds: ['city'],

  pages(place) {
    const row = topicTable<IssRow>('iss').rows[place.id];
    if (!row) return [];
    const lat = place.at[1];
    return [{ slug: 'iss', data: { tz: row.tz, lat, best: Math.round(issBestElevation(lat)) }, index: row.index === true }];
  },

  header(place, { data }, t) {
    const name = (t: Translate) => nameOf(place, t);
    const reach = data.best >= SKY_RULES.issMinElevation;
    const where = { lat: latitudeOf(data.lat, t), best: data.best, side: side(data.lat) };
    return {
      title: fit(placeFirst(place, reach ? [
        (t, city) => t('ISS passes over {city}: when to see the space station', { city }),
        (t, city) => t('ISS over {city}: when to see the space station', { city }),
        (t, city) => t('ISS passes over {city}: next visible passes', { city }),
        (t, city) => t('ISS passes over {city}', { city }),
      ] : [
        (t, city) => t('Can you see the ISS from {city}?', { city }),
        (t, city) => t('The ISS from {city}', { city }),
      ]), t, TITLE_MAX),
      description: fit(reach ? [
        ...(data.best < 89 ? [
          (t: Translate) => t('When the International Space Station next passes over {place}, in local time, and how high it gets: never more than {best}° here.', { place: placeName(place, t), best: data.best }),
          (t: Translate) => t('When the International Space Station next passes over {city}, in local time, and how high it gets: never more than {best}° here.', { city: name(t), best: data.best }),
        ] : []),
        t => t('When the International Space Station next passes over {place}, in local time: each visible pass, where it rises, how high it climbs and where it sets.', { place: placeName(place, t) }),
        t => t('When the International Space Station next passes over {city}, in local time: each visible pass, where it rises, how high it climbs and where it sets.', { city: name(t) }),
        t => t('When the space station next passes over {city}, in local time: each visible pass, where it rises, how high it climbs and where it sets.', { city: name(t) }),
        t => t('When the ISS next passes over {city}, in local time, with where each visible pass rises and how high it climbs.', { city: name(t) }),
      ] : [
        t => t('From {place} the International Space Station never climbs more than about {best}° above the horizon: why, and where it can be seen from.', { place: placeName(place, t), best: data.best }),
        t => t('From {city} the International Space Station never climbs more than about {best}° above the horizon: why, and where it can be seen from.', { city: name(t), best: data.best }),
        t => t('From {city} the ISS never climbs more than about {best}° above the horizon, too low to see well: why, and where it can be seen from.', { city: name(t), best: data.best }),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: reach ? t('When to see the ISS from {city}', { city: placeName(place, t) }) : t('The ISS from {city}', { city: placeName(place, t) }),
      lede: data.best >= 89
        ? t(wordingOf(place, 'lede', [msg('The International Space Station’s next passes over {city}, worked out from its latest orbital elements when this page loads, in local time. At {lat}, it can pass straight overhead.'), msg('When the International Space Station next crosses the sky over {city}, in local time, from its latest orbital elements. At {lat}, it can pass straight overhead.')]), { city: name(t), ...where })
        : reach
          ? t(wordingOf(place, 'lede', [msg('The International Space Station’s next passes over {city}, worked out from its latest orbital elements when this page loads, in local time. At {lat} it never passes overhead: at most it climbs about {best}° above the {side, select, south {southern} other {northern}} horizon.'), msg('When the International Space Station next crosses the sky over {city}, in local time, from its latest orbital elements. At {lat} it never goes overhead: at most it climbs about {best}° above the {side, select, south {southern} other {northern}} horizon.')]), { city: name(t), ...where })
          : t('From {city}, at {lat}, the space station never climbs more than about {best}° above the {side, select, south {southern} other {northern}} horizon: its orbit doesn’t reach far enough {side, select, south {north} other {south}}. It is seen well up to about 64° from the equator.', { city: name(t), ...where }),
    };
  },

  summary(place, { data }, t) {
    if (data.best < SKY_RULES.issMinElevation) return t('Never more than {best}° above the horizon here.', { best: data.best });
    return data.best >= 89
      ? t('The next visible passes in local time; it can pass straight overhead.')
      : t('The next visible passes in local time; it climbs at most {best}° here.', { best: data.best });
  },

  // Far enough out that the orbit curves around the globe in the header's frame.
  open: () => ({ layers: ['sat_science'], zoom: 1.8, track: `satellite:${ISS_NORAD}` }),

  live: (place, { data }) => passesNow(place, data),

  liveLabel: msg('Next passes · worked out at {time}'),
};

export type IssPage = TopicPage<IssData>;

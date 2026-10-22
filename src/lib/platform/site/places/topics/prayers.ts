import { msg, type Translate } from '@/lib/core/i18n/translator';
import { fit, listOf, nameOf, placeFirst, placeName, sentenceStart, TITLE_MAX, wordingOf } from '../copy/format';
import type { Place } from '../gazetteer';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import { faithShown, type Faith } from './faith-reach';
import type { IssRow } from './sky-data';

/**
 * A city's Prayers page at /city/<place>/prayers: the one way from its nav to its faith pages, and only to those of
 * its country's majority faith (faith-reach.ts). Navigation, so never indexed; where no faith is shown it doesn't exist.
 */

export interface PrayersData { tz: string; faiths: Faith[] }

export const PRAYERS_SLUG = 'prayers';

const things = (faiths: Faith[], t: Translate) => listOf(faiths.flatMap(f => (f === 'muslim' ? [t('prayer times'), t('Ramadan timetables')] : [t('Shabbat times')])), t);

export const PRAYERS: PlaceTopic<PrayersData> = {
  id: 'prayers',
  label: msg('Prayers'),
  inline: msg('prayers'),
  kinds: ['city'],
  faith: true,

  pages(place: Place) {
    const row = topicTable<IssRow>('iss').rows[place.id];
    const faiths = row ? faithShown(place) : [];
    return faiths.length ? [{ slug: PRAYERS_SLUG, data: { tz: row.tz, faiths }, index: false }] : [];
  },

  header(place, { data }, t) {
    const name = (t: Translate) => nameOf(place, t);
    return {
      title: fit(placeFirst(place, [
        (t, city) => t('Prayers in {city}: {things}', { city, things: things(data.faiths, t) }),
        (t, city) => t('Prayers in {city}', { city }),
      ]), t, TITLE_MAX),
      description: t('{things} for {place}, worked out for the city’s own clock, with the dates of the year’s holy days.', { things: sentenceStart(things(data.faiths, t)), place: placeName(place, t) }),
      heading: t('Prayers in {city}', { city: placeName(place, t) }),
      lede: t(wordingOf(place, 'lede', [msg('Where to find {things} for {city}, worked out for the city’s own clock, and the dates of the holy days in every year.'), msg('For {city}: {things}, worked out for the city’s own clock, and the dates of the holy days in every year.')]), { things: things(data.faiths, t), city: name(t) }),
    };
  },

  summary: (_place, { data }, t) => t('{things}, worked out for the city’s own clock.', { things: sentenceStart(things(data.faiths, t)) }),

  open: () => ({ layers: ['day_night'], zoom: 3 }),
};

export type PrayersPage = TopicPage<PrayersData>;

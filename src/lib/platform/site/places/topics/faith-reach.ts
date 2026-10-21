import type { Place } from '../place';
import { topicTable } from '../tables';

/**
 * Where a faith's pages exist, and where a city's own pages lead to them. Prayer times and Ramadan exist where Muslims
 * are a community worth a timetable, Shabbat times in Israel and the cities with large Jewish communities; but a
 * city's Prayers page and nav show only the faith of the country's majority. The others are reached from search
 * and from the dates pages (/ramadan, /jewish-holidays).
 */

export interface JewishCommunityRow { jews: number; name: string }

/** Muslim share of the population, %, by ISO2: tools/site/topics/muslim-share.ts (Wikipedia, "Islam by country"). */
const muslimShare = (cc: string) => topicTable<number>('muslim-share').rows[cc] ?? 0;

export const MUSLIM_REACH = { share: 10, minorityShare: 1, minorityPopulation: 300_000, majority: 50 } as const;

/** Regions where Muslims are a large share inside a country where they are few, by GeoNames admin1. */
const MUSLIM_REGIONS = new Set([
  // Wikipedia, "Islam in China": Uyghur, Hui and Kazakh Muslims, most numerous in Xinjiang, Ningxia, Gansu and Qinghai.
  'CN.13', 'CN.21', 'CN.15', 'CN.06',
  // Wikipedia, "Islam in Thailand": Malay Muslims are most people in Pattani, Yala, Narathiwat and Satun.
  'TH.69', 'TH.70', 'TH.31', 'TH.67',
  // Wikipedia, "Islam in the Philippines": the Bangsamoro region, GeoNames' Autonomous Region in Muslim Mindanao.
  'PH.14',
]);

export function muslimPages(place: Place): boolean {
  const share = muslimShare(place.cc);
  return share >= MUSLIM_REACH.share
    || (share >= MUSLIM_REACH.minorityShare && place.pop >= MUSLIM_REACH.minorityPopulation)
    || (!!place.admin1 && MUSLIM_REGIONS.has(place.admin1));
}

/** Cities outside Israel with 10,000 Jews or more: tools/site/topics/jewish-communities.ts. */
export const jewishCommunity = (place: Place) => topicTable<JewishCommunityRow>('jewish-communities').rows[place.id];

export const jewishPages = (place: Place) => place.cc === 'IL' || !!jewishCommunity(place);

export type Faith = 'muslim' | 'jewish';

/** The faiths with pages for the place, whether or not its own pages link them. */
export function faithPages(place: Place): Faith[] {
  return [...(muslimPages(place) ? ['muslim' as const] : []), ...(jewishPages(place) ? ['jewish' as const] : [])];
}

/** The faiths the place's Prayers page and nav show: its country's majority faith. */
export function faithShown(place: Place): Faith[] {
  return faithPages(place).filter(f => (f === 'muslim' ? muslimShare(place.cc) >= MUSLIM_REACH.majority : place.cc === 'IL'));
}

const TOPIC_FAITH: Record<string, Faith> = { prayer: 'muslim', ramadan: 'muslim', shabbat: 'jewish' };

/** Whether the place's Prayers page leads to this faith topic's pages. */
export const topicShown = (place: Place, topicId: string) => !!TOPIC_FAITH[topicId] && faithShown(place).includes(TOPIC_FAITH[topicId]);

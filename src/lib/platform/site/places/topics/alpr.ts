import { msg, type Translate } from '@/lib/core/i18n/translator';
import { count, DESCRIPTION_RANGE, fit, nameOf, placeName, TITLE_MAX } from '../copy/format';
import { placeLabel } from '../gazetteer';
import type { Place } from '../place';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import { ALPR_INDEX, type AlprMeta, type AlprRow } from './alpr-data';

/**
 * Licence-plate readers at /<kind>/<place>/flock-cameras: how many are mapped in a US or Canadian city, a US town,
 * county or state, or a country, who runs and makes them, which way they face, and the places inside with the most. Counted
 * from OpenStreetMap through DeFlock (alpr-data.ts); indexed from ALPR_INDEX readers. The slug is what people search
 * for; the copy says "Flock cameras" only where Flock Safety made most of the place's readers.
 */

export interface AlprData { row: AlprRow; asOf: string }

export const flockMost = (row: AlprRow) => row.flock * 2 > row.n;

/** Where the count was made, as the copy says it: around a city without limits, in anything else. */
function where(place: Place, row: AlprRow, t: Translate): string {
  return row.r ? t('in and around {place}', { place: placeName(place, t) }) : t('in {place}', { place: placeName(place, t) });
}

export const ALPR: PlaceTopic<AlprData> = {
  id: 'alpr',
  label: msg('Flock cameras'),
  inline: msg('plate readers'),
  kinds: ['city', 'town', 'county', 'state', 'country'],

  pages(place) {
    const table = topicTable<AlprRow, AlprMeta>('alpr');
    const row = table.rows[place.id];
    if (!row) return [];
    return [{ slug: 'flock-cameras', data: { row, asOf: table.meta?.asOf ?? table.generated }, index: row.n >= ALPR_INDEX[place.kind] }];
  },

  header(place, { data: { row } }, t) {
    const v = (t: Translate) => ({ city: nameOf(place, t), place: placeName(place, t), where: where(place, row, t), n: row.n, flock: row.flock, nf: count(row.n, t) });
    // Only where even the shortest title is too long: "Lower Connecticut River Valley Planning Region".
    const bare = (t: Translate) => ({ city: placeLabel(place, t.locale) });
    const flock = flockMost(row);
    const op = row.ops[0]?.[0];
    const titles: ((t: Translate) => string)[] = place.kind === 'state'
      ? flock
        ? [t => t('{city} Flock cameras: {nf} plate readers, county by county', v(t)), t => t('{city} Flock cameras by county: {nf} mapped', v(t)), t => t('Flock cameras in {city} state', v(t))]
        : [t => t('{city} plate readers (ALPR): {nf} mapped, county by county', v(t)), t => t('{city} ALPR cameras by county: {nf} mapped', v(t)), t => t('ALPR cameras in {city} state', v(t))]
      : flock
        ? [t => t('{city} Flock cameras: {nf} plate readers mapped', v(t)), t => t('{city} Flock cameras: {nf} mapped', v(t)), t => t('{city} Flock cameras', v(t)), t => t('{city} Flock cameras', bare(t))]
        : [t => t('{city} plate readers (ALPR): {nf} cameras mapped', v(t)), t => t('{city} ALPR cameras: {nf} mapped', v(t)), t => t('{city} ALPR cameras', v(t)), t => t('{city} ALPR cameras', bare(t))];
    const facing = (t: Translate) => t('which way each one faces');
    return {
      title: fit(titles, t, TITLE_MAX),
      description: fit([
        ...(op ? [(t: Translate) => t('{n, plural, one {One licence-plate reader} other {# licence-plate readers}} mapped {where}, {flock, plural, =0 {none by Flock} one {one by Flock Safety} other {# by Flock Safety}}, run by {op} and others: {facing}, on a free map.', { ...v(t), op, facing: facing(t) })] : []),
        t => t('{n, plural, one {One licence-plate reader} other {# licence-plate readers}} mapped {where}, {flock, plural, =0 {none by Flock} one {one by Flock Safety} other {# by Flock Safety}}: who runs them and {facing}, on a free map.', { ...v(t), facing: facing(t) }),
        t => t('{n, plural, one {One licence-plate reader} other {# licence-plate readers}} mapped in {city}, {flock, plural, =0 {none by Flock} one {one by Flock Safety} other {# by Flock Safety}}, with who runs them and {facing}.', { ...v(t), facing: facing(t) }),
        t => t('Licence-plate readers (ALPR) mapped in {city}, Flock cameras among them: who runs them, who makes them and {facing}, on a free map.', { ...v(t), facing: facing(t) }),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: flock ? t('Flock cameras in {city}', v(t)) : t('Licence-plate readers in {city}', v(t)),
      lede: lede(place, row, t),
    };
  },

  summary(_place, { data: { row } }, t) {
    return t('{n, plural, one {One plate reader mapped} other {# plate readers mapped}}, {flock, plural, =0 {none by Flock} one {one by Flock Safety} other {# by Flock Safety}}.', { n: row.n, flock: row.flock });
  },

  // Each reader shows from zoom 9 and its view cone from 13.
  open: place => ({ layers: ['alpr'], ...(place.kind === 'city' ? { zoom: 12 } : {}) }),
};

function lede(place: Place, row: AlprRow, t: Translate): string {
  const v = { city: nameOf(place, t), n: row.n, flock: row.flock, dir: row.dir, km: row.r ?? 0 };
  const counted = row.r
    ? t('{n, plural, one {One licence-plate reader is} other {# licence-plate readers are}} mapped within {km} km of the centre of {city}, {flock, plural, =0 {none of them by Flock Safety} one {one of them by Flock Safety} other {# of them by Flock Safety}}.', v)
    : row.bound === 'limits'
      ? t('{n, plural, one {One licence-plate reader is} other {# licence-plate readers are}} mapped inside the limits of {city}, {flock, plural, =0 {none of them by Flock Safety} one {one of them by Flock Safety} other {# of them by Flock Safety}}.', v)
      : t('{n, plural, one {One licence-plate reader is} other {# licence-plate readers are}} mapped in {city}, {flock, plural, =0 {none of them by Flock Safety} one {one of them by Flock Safety} other {# of them by Flock Safety}}.', v);
  const facing = row.dir === row.n
    ? t('Each has the direction it faces mapped, so the map draws where it looks.')
    : t('{dir, plural, =0 {None has the direction it faces mapped yet.} one {One has the direction it faces mapped, so the map draws where it looks.} other {# have the direction they face mapped, so the map draws where each looks.}}', v);
  return `${counted} ${facing}`;
}

export type AlprPage = TopicPage<AlprData>;

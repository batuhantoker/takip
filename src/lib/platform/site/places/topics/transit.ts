import { msg, type Translate } from '@/lib/core/i18n/translator';
import { count, dayOf, DESCRIPTION_RANGE, fit, listOf, modesPlural, nameOf, placeName, sentenceStart, TITLE_MAX } from '../copy/format';
import { reachKm, type Place } from '../gazetteer';
import { transitNow, type TransitNow } from '../live/transit-now';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import type { TransitMeta, TransitRow } from './transit-data';

/**
 * Buses, trams and trains at /city/<place>/transit: who runs them there, how each operator's vehicles reach the map,
 * and what is running right now. A page for every place the transit layer lists; indexed where at least one
 * operator publishes live positions.
 */

export interface TransitData extends TransitRow { seen: string }

const live = (d: TransitRow) => d.operators.filter(o => o.how !== 'timetable').map(o => o.name);

/** The square the live count covers: the place's own reach, and never less than a 12 km walk out. */
export const transitKm = (place: Place) => Math.round(Math.max(12, reachKm(place)));

export const TRANSIT: PlaceTopic<TransitData, TransitNow> = {
  id: 'transit',
  label: msg('Transit'),
  kinds: ['city'],

  pages(place) {
    const table = topicTable<TransitRow, TransitMeta>('transit');
    const row = table.rows[place.id];
    return row ? [{ slug: 'transit', data: { ...row, seen: table.meta?.seen ?? table.generated }, index: live(row).length > 0 }] : [];
  },

  header(place, { data }, t) {
    const name = (t: Translate) => nameOf(place, t);
    const modes = (t: Translate) => modesPlural(data.modes, t);
    const ops = live(data);
    return {
      title: fit([
        t => t('{city} live transit tracker: {modes} on a map', { city: name(t), modes: modes(t) }),
        t => t('{city} live transit tracker: {modes}', { city: name(t), modes: modes(t) }),
        t => t('{city} live transit tracker', { city: name(t) }),
      ], t, TITLE_MAX),
      description: fit([
        t => t('Where {operators} vehicles are right now in {place}: {modes} on a free live map, refreshed every 20 seconds.', { operators: listOf(ops, t), place: placeName(place, t), modes: modes(t) }),
        t => t('Where the {modes} of {place} are right now, on a free live map refreshed every 20 seconds, with each vehicle’s route, status and operator.', { place: placeName(place, t), modes: modes(t) }),
        t => t('Where the {modes} of {city} are right now, on a free live map refreshed every 20 seconds, with each vehicle’s route and status.', { city: name(t), modes: modes(t) }),
        t => t('Where public transport in {place} is right now: every vehicle on a free live map, refreshed every 20 seconds, with its route and status.', { place: placeName(place, t) }),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: t('{modes} in {city}, live', { modes: sentenceStart(modes(t)), city: name(t) }),
      lede: !ops.length
        ? t('No operator in {city} publishes live positions, so its vehicles run from the timetable and are marked scheduled.', { city: name(t) })
        : data.vehicles >= 10
          ? t('{n, plural, one {{operators} publishes where its vehicles are} other {{operators} publish where their vehicles are}}. On {day}, when TAKIP last checked, about {vehicles} were running at once; the map shows them as they move.', {
            n: ops.length, operators: listOf(ops, t), day: dayOf(data.seen, t), vehicles: count(Math.round(data.vehicles / 10) * 10, t),
          })
          : t('{n, plural, one {{operators} publishes where its vehicles are} other {{operators} publish where their vehicles are}}. TAKIP draws them on one live map as they move, refreshed every 20 seconds while you are zoomed in.', {
            n: ops.length, operators: listOf(ops, t),
          }),
    };
  },

  summary(place, { data }, t) {
    return t('{operators}: {modes}.', { operators: listOf(data.operators.map(o => o.name), t), modes: modesPlural(data.modes, t) });
  },

  open: () => ({ layers: ['transit'], zoom: 12 }),

  live: place => transitNow(place, transitKm(place)),
};

export type TransitPage = TopicPage<TransitData>;

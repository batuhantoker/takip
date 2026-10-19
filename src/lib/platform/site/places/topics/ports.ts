import { msg, type Translate } from '@/lib/core/i18n/translator';
import { count, DESCRIPTION_RANGE, fit, nameOf, placeName, TITLE_MAX } from '../copy/format';
import type { Place } from '../gazetteer';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import { foldName, placePorts, PORT_KM, type PlacePorts, type PortsMeta, type PortsRow } from './ports-data';
import { portStory, renderSentence, straitName, type PortKind, type PortStory } from './ports-facts';
import { shipsNow, type ShipsNow } from './ports-live';

/**
 * Ships and the harbour at /city/<place>/port: what NGA's World Port Index records about the harbours within
 * 10 km, whether the map marks it as a major port or it sits on a chokepoint, how well AIS is heard there, and
 * the ships near it right now. Indexed by PORT_INDEX (ports-facts.ts): a medium or large harbour credited to the
 * place, a major port, or a busy small one, where the AIS sample heard ships.
 */

export interface PortsData extends PlacePorts { story: PortStory }

/** Without aisstream.io's key the map has ports but no ships, and the page would promise what it can't show. */
const hasAis = () => !!process.env.AIS_API_KEY?.trim();

/** The harbour's name as the page writes it: the place's spelling when the Index spells the same name without accents. */
export const portLabel = (port: string, place: Place, t: Translate) => (foldName(port) === foldName(place.name) ? nameOf(place, t) : port);

const TITLES: Record<PortKind, (t: Translate, v: { city: string; port: string; strait: string }) => string> = {
  'container-hub': (t, v) => t('{city} port live: container ships on a map', v),
  'energy-port': (t, v) => t('{city} port live: ships at an oil and gas port', v),
  'naval-base': (t, v) => t('{city} harbour live: ships around {port}', v),
  strait: (t, v) => t('Ships on the {strait} at {city}, live', v),
  ferry: (t, v) => t('{city} ferry port live: ships on a map', v),
  fishing: (t, v) => t('{city} harbour live: fishing boats and ships', v),
  cargo: (t, v) => t('{city} port live: cargo ships on a map', v),
  river: (t, v) => t('{city} river port live: ships on a map', v),
  roadstead: (t, v) => t('{city} roadstead live: ships at anchor on a map', v),
  harbour: (t, v) => t('{city} harbour live: ships on a map', v),
};

const span = (from: string, to: string, t: Translate) =>
  new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'short', timeZone: 'UTC' }).formatRange(Date.parse(from), Date.parse(to) - 1);

export const PORTS: PlaceTopic<PortsData, ShipsNow> = {
  id: 'ports',
  label: msg('Port and ships'),
  inline: msg('port and ships'),
  kinds: ['city'],

  pages(place) {
    if (!hasAis()) return [];
    const table = topicTable<PortsRow, PortsMeta>('ports');
    const row = table.rows[place.id];
    if (!row || !table.meta) return [];
    const data = placePorts(place.id, row, table.meta);
    const story = portStory(data);
    return story ? [{ slug: 'port', data: { ...data, story }, index: story.index }] : [];
  },

  header(place, { data }, t) {
    const { story } = data;
    const v = (t: Translate) => ({ city: nameOf(place, t), port: portLabel(story.lead.name, place, t), strait: data.chokepoint ? straitName(data.chokepoint.name, t) : '' });
    const heard = data.ais && (story.coverage === 'heard' || story.coverage === 'busy') ? story.watch : undefined;
    const counted = (t: Translate) => ({
      ...v(t), place: placeName(place, t), n: count(story.watch.heard ?? 0, t),
      km: PORT_KM, hours: data.ais?.hours ?? 0, span: data.ais ? span(data.ais.from, data.ais.to, t) : '',
    });
    return {
      title: fit([
        t => TITLES[story.kind](t, v(t)),
        t => t('{city} port and ships, live on a map', v(t)),
        t => t('{city} port live', v(t)),
      ], t, TITLE_MAX),
      description: fit([
        ...(heard ? [
          (t: Translate) => t('Ships in and around the port of {place} on a free live map, from AIS: {n} different ships were heard within {km} km in {hours} sampled hours, {span}.', counted(t)),
          (t: Translate) => t('Ships at {city} on a free live map, from AIS: {n} heard within {km} km in {hours} sampled hours, {span}, each with its speed and destination.', counted(t)),
        ] : []),
        t => t('Ships around {place} on a free live map from AIS, with speed, heading and destination, and what NGA’s World Port Index records about {port}.', { ...v(t), place: placeName(place, t) }),
        t => t('Ships around {city} on a free live map from AIS, with speed, heading and destination, and what NGA’s World Port Index records about its harbour.', v(t)),
        t => t('Ships around {city} on a free live map from AIS, and what NGA’s World Port Index records about its harbour.', v(t)),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: t('{city} port and ships, live', v(t)),
      lede: renderSentence(story.sentences[0], nameOf(place, t), t),
    };
  },

  summary(place, { data: { story } }, t) {
    return t('{port}, {km} km from the centre.', { port: portLabel(story.lead.name, place, t), km: Math.max(1, Math.round(story.lead.km)) });
  },

  open: (_place, { data: { story } }) => ({
    layers: story.kind === 'strait' ? ['maritime', 'chokepoint_flow'] : ['maritime'],
    view: { lat: story.watch.at[1], lon: story.watch.at[0], zoom: 11 },
  }),

  // Where the AIS sample heard nothing, a live count would be an empty promise.
  live: async (_place, { data: { story } }) => (story.coverage === 'silent' ? null : shipsNow(story.watch)),
};

export type PortsPage = TopicPage<PortsData>;

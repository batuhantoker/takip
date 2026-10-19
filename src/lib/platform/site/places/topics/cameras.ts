import { msg, type Translate } from '@/lib/core/i18n/translator';
import { count, DESCRIPTION_RANGE, fit, listOf, nameOf, placeName, TITLE_MAX } from '../copy/format';
import { reachKm, type Place } from '../gazetteer';
import type { PlaceTopic, TopicPage } from '../topic';
import { camerasNear } from './camera-catalogue';

/**
 * Public cameras at /city/<place>/cameras: who publishes the ones around the place and which they are. Read from the
 * app's own camera catalogue when the page renders, so the count is current. A page wherever one camera is listed,
 * even off air (a search for a town's cameras deserves the truth about them); indexed from two on air.
 */

export interface CamerasData {
  km: number;
  onAir: number;
  offAir: number;
  /** [source, cameras on air], most first; sources with fewer than three, or named after a place, are in `others`. */
  sources: [string, number][];
  others: number;
  /** Nearest first; on air where any are, otherwise the off-air ones. */
  picks: { name: string; at: [number, number]; source: string; offline: boolean }[];
  /** When the catalogue was built, epoch ms. */
  counted: number;
}

const MIN_INDEXED = 2;
const PICKS = 12;

/** A source named after a place ("Cincinnati, OH") says nothing about who runs the camera. */
const namedSource = (source: string, n: number) => n >= 3 && !!source && !/,\s*[A-Z]{2}$/.test(source);
const cleanName = (name: string) => name.replace(/,\s*\d+$/, '').replace(/\s+/g, ' ').trim();

export const camerasKm = (place: Place) => Math.round(Math.max(8, reachKm(place)));

export function camerasData(place: Place): CamerasData | null {
  const km = camerasKm(place);
  const near = camerasNear(place.at, km);
  if (!near?.cameras.length) return null;
  const onAir = near.cameras.filter(c => !c.offline);
  const bySource = new Map<string, number>();
  for (const c of onAir) bySource.set(c.source, (bySource.get(c.source) ?? 0) + 1);
  const sources = [...bySource].filter(([s, n]) => namedSource(s, n)).sort((a, b) => b[1] - a[1]);
  const seen = new Set<string>();
  const picks = (onAir.length ? onAir : near.cameras).filter(c => {
    const name = cleanName(c.name).toLowerCase();
    if (!name || seen.has(name)) return false;
    seen.add(name);
    return true;
  }).slice(0, PICKS).map(c => ({ name: cleanName(c.name), at: [Number(c.lng.toFixed(5)), Number(c.lat.toFixed(5))] as [number, number], source: c.source, offline: c.offline }));
  return {
    km, onAir: onAir.length, offAir: near.cameras.length - onAir.length,
    sources, others: onAir.length - sources.reduce((s, [, n]) => s + n, 0), picks, counted: near.builtAt,
  };
}

export const CAMERAS: PlaceTopic<CamerasData> = {
  id: 'cameras',
  label: msg('Cameras'),
  inline: msg('cameras'),
  kinds: ['city'],

  pages(place) {
    const data = camerasData(place);
    return data ? [{ slug: 'cameras', data, index: data.onAir >= MIN_INDEXED }] : [];
  },

  header(place, { data }, t) {
    const name = (t: Translate) => nameOf(place, t);
    const n = (t: Translate) => count(data.onAir, t);
    const top = data.sources.slice(0, 2).map(([s]) => s);
    if (!data.onAir) {
      return {
        title: fit([
          t => t('{city} cameras: {n, plural, one {# listed, off air} other {# listed, all off air}}', { city: name(t), n: data.offAir }),
          t => t('{city} cameras', { city: name(t) }),
        ], t, TITLE_MAX),
        description: fit([
          t => t('{n, plural, one {One public camera is} other {# public cameras are}} listed in and around {place}, but none is streaming now. Here is which they are, and other cameras nearby.', { n: data.offAir, place: placeName(place, t) }),
          t => t('Public cameras listed in and around {city}, none streaming now: which they are, who published them, and live cameras elsewhere nearby.', { city: name(t) }),
        ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
        heading: t('Cameras in {city}', { city: name(t) }),
        lede: t('{n, plural, one {One camera is} other {# cameras are}} listed within {km} km of {city}, but none is streaming right now. Cameras that go dark, for maintenance or policy reasons, stay on the map faded and marked off air, in case they come back.', { n: data.offAir, km: data.km, city: name(t) }),
      };
    }
    return {
      title: fit([
        t => t('{city} live cameras: {n, plural, one {# public camera} other {# public cameras}} on a map', { city: name(t), n: data.onAir }),
        t => t('{city} live cameras: {n} on a map', { city: name(t), n: n(t) }),
        t => t('{city} live cameras', { city: name(t) }),
      ], t, TITLE_MAX),
      description: fit([
        ...(top.length ? [(t: Translate) => t('{n, plural, one {One public camera} other {# public cameras}} in and around {place}, from {sources}, on one live map. Click one for its latest picture or live stream.', { n: data.onAir, place: placeName(place, t), sources: listOf(top, t) })] : []),
        ...(top.length ? [(t: Translate) => t('{n, plural, one {One public camera} other {# public cameras}} in and around {city}, from {sources}, on one live map. Click one to watch.', { n: data.onAir, city: name(t), sources: top[0] })] : []),
        t => t('{n, plural, one {One public camera} other {# public cameras}} in and around {place}, from road authorities, cities and webcam networks, on one live map. Click one to watch.', { n: data.onAir, place: placeName(place, t) }),
        t => t('{n, plural, one {One public camera} other {# public cameras}} in and around {city} on one live map, from road authorities, cities and webcam networks. Click one to watch.', { n: data.onAir, city: name(t) }),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: t('Live cameras in {city}', { city: name(t) }),
      lede: top.length
        ? t('{n, plural, one {One camera} other {# cameras}} within {km} km of the centre of {city}, most of them from {sources}. TAKIP pins them on one map, so you can look at a street or a road as it is now.', { n: data.onAir, km: data.km, city: name(t), sources: listOf(top, t) })
        : t('{n, plural, one {One camera} other {# cameras}} within {km} km of the centre of {city}. TAKIP pins them on one map, so you can look at a street or a road as it is now.', { n: data.onAir, km: data.km, city: name(t) }),
    };
  },

  summary(place, { data }, t) {
    if (!data.onAir) return t('{n, plural, one {One camera listed, off air.} other {# cameras listed, all off air.}}', { n: data.offAir });
    const sources = data.sources.slice(0, 3).map(([s]) => s).concat(data.others ? [t('others')] : []);
    return sources.length
      ? t('{n, plural, one {One camera} other {# cameras}}, from {sources}.', { n: data.onAir, sources: listOf(sources, t) })
      : t('{n, plural, one {One camera} other {# cameras}} on the map.', { n: data.onAir });
  },

  open: () => ({ layers: ['cctv', 'cctv_previews'], zoom: 11 }),
};

export type CamerasPage = TopicPage<CamerasData>;

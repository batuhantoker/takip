import { msg, type Translate } from '@/lib/core/i18n/translator';
import { count, DESCRIPTION_RANGE, fit, listOf, nameOf, placeFirst, placeName, TITLE_MAX, wordingOf } from '../copy/format';
import { km as kmBetween, reachKm, type Place } from '../gazetteer';
import type { PlaceTopic, TopicPage } from '../topic';
import { camerasNear, type CameraLook, type CameraStream, type CatalogueCamera } from './camera-catalogue';

/**
 * Public cameras at /city/<place>/cameras: who publishes the ones around the place and which they are. Read from the
 * app's own camera catalogue when the page renders, so the count is current. A page wherever one camera is listed,
 * even off air (a search for a town's cameras deserves the truth about them); indexed from two on air.
 */

export interface CameraPick { name: string; at: [number, number]; source: string; offline: boolean; km: number; look?: CameraLook }

export interface CamerasData {
  km: number;
  onAir: number;
  offAir: number;
  /** [source, cameras on air], most first; sources with fewer than three, or named after a place, are in `others`. */
  sources: [string, number][];
  others: number;
  /** Nearest first; on air where any are, otherwise the off-air ones. */
  picks: CameraPick[];
  /** On-air stills nearest the centre, each at least FRAME_APART_KM from the others: what the page shows as pictures. */
  frames: (CameraPick & { frame: string })[];
  /** The same for video, which the page plays only when asked; [] where there are frames. */
  streams: (CameraPick & { stream: CameraStream })[];
  /** The on-air camera nearest the centre that the map draws as a picture tile, where "Open the live map" centres. */
  tileAt?: [number, number];
  /** When the catalogue was built, epoch ms. */
  counted: number;
}

const MIN_INDEXED = 2;
const PICKS = 12;
const FRAMES = 6;
const STREAMS = 4;
/** Two views from one junction read as the same picture. */
const FRAME_APART_KM = 0.2;
/** cctv-previews.tsx draws picture tiles from this zoom. */
export const CAMERA_TILE_ZOOM = 13;

/** A source named after a place ("Cincinnati, OH") says nothing about who runs the camera. */
const namedSource = (source: string, n: number) => n >= 3 && !!source && !/,\s*[A-Z]{2}$/.test(source);
const cleanName = (name: string) => name.replace(/,\s*\d+$/, '').replace(/\s+/g, ' ').trim();
const round5 = (c: CatalogueCamera): [number, number] => [Number(c.lng.toFixed(5)), Number(c.lat.toFixed(5))];

export const camerasKm = (place: Place) => Math.round(Math.max(8, reachKm(place)));

/** Nearest first, one per name. */
function distinct<C extends CatalogueCamera>(cameras: C[]): C[] {
  const seen = new Set<string>();
  return cameras.filter(c => {
    const name = cleanName(c.name).toLowerCase();
    if (!name || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

/** Up to `n`, nearest first, none within FRAME_APART_KM of another. */
function spread<C extends CatalogueCamera & { km: number }>(cameras: C[], n: number): C[] {
  const out: C[] = [];
  for (const c of distinct(cameras)) {
    if (out.length >= n) break;
    if (!out.some(o => kmBetween([o.lng, o.lat], [c.lng, c.lat]) < FRAME_APART_KM)) out.push(c);
  }
  return out;
}

const pickOf = (c: CatalogueCamera & { km: number }): CameraPick => ({
  name: cleanName(c.name), at: round5(c), source: c.source, offline: c.offline, km: Math.round(c.km * 100) / 100, ...(c.look ? { look: c.look } : {}),
});

export function camerasData(place: Place): CamerasData | null {
  const km = camerasKm(place);
  const near = camerasNear(place.at, km);
  if (!near?.cameras.length) return null;
  const onAir = near.cameras.filter(c => !c.offline);
  const bySource = new Map<string, number>();
  for (const c of onAir) bySource.set(c.source, (bySource.get(c.source) ?? 0) + 1);
  const sources = [...bySource].filter(([s, n]) => namedSource(s, n)).sort((a, b) => b[1] - a[1]);
  const picks = distinct(onAir.length ? onAir : near.cameras).slice(0, PICKS).map(pickOf);
  const frames = spread(onAir.filter(c => c.frame), FRAMES).map(c => ({ ...pickOf(c), frame: c.frame! }));
  const streams = frames.length ? [] : spread(onAir.filter(c => c.stream), STREAMS).map(c => ({ ...pickOf(c), stream: c.stream! }));
  const tile = onAir.find(c => c.look === 'still' || c.look === 'stream');
  return {
    km, onAir: onAir.length, offAir: near.cameras.length - onAir.length,
    sources, others: onAir.length - sources.reduce((s, [, n]) => s + n, 0), picks, frames, streams,
    ...(tile ? { tileAt: round5(tile) } : {}), counted: near.builtAt,
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
        title: fit(placeFirst(place, [
          (t, city) => t('{city} cameras: {n, plural, one {# listed, off air} other {# listed, all off air}}', { city, n: data.offAir }),
          (t, city) => t('{city} cameras', { city }),
        ]), t, TITLE_MAX),
        description: fit([
          t => t('{n, plural, one {One public camera is} other {# public cameras are}} listed in and around {place}, but none is streaming now. Here is which they are, and other cameras nearby.', { n: data.offAir, place: placeName(place, t) }),
          t => t('Public cameras listed in and around {city}, none streaming now: which they are, who published them, and live cameras elsewhere nearby.', { city: name(t) }),
        ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
        heading: t('Cameras in {city}', { city: placeName(place, t) }),
        lede: t(wordingOf(place, 'lede', [msg('{n, plural, one {One camera is} other {# cameras are}} listed within {km, radius} of {city}, but none is streaming right now. Cameras that go dark, for maintenance or policy reasons, stay on the map faded and marked off air, in case they come back.'), msg('{n, plural, one {One camera is} other {# cameras are}} listed within {km, radius} of {city}, all dark right now. Cameras switched off for maintenance or policy stay on the map, faded and marked off air, in case they return.')]), { n: data.offAir, km: data.km, city: name(t) }),
      };
    }
    return {
      title: fit(placeFirst(place, [
        (t, city) => t('{city} webcams and live cameras: {n} on a map', { city, n: n(t) }),
        (t, city) => t('{city} live cameras: {n, plural, one {# public camera} other {# public cameras}} on a map', { city, n: data.onAir }),
        (t, city) => t('{city} live cameras: {n} on a map', { city, n: n(t) }),
        (t, city) => t('{city} live cameras', { city }),
      ]), t, TITLE_MAX),
      description: fit([
        ...(top.length ? [(t: Translate) => t('{n, plural, one {One public camera} other {# public cameras}} in and around {place}, from {sources}, on one live map. Click one for its latest picture or live stream.', { n: data.onAir, place: placeName(place, t), sources: listOf(top, t) })] : []),
        ...(top.length ? [(t: Translate) => t('{n, plural, one {One public camera} other {# public cameras}} in and around {city}, from {sources}, on one live map. Click one to watch.', { n: data.onAir, city: name(t), sources: top[0] })] : []),
        t => t('{n, plural, one {One public camera} other {# public cameras}} in and around {place}, from road authorities, cities and webcam networks, on one live map. Click one to watch.', { n: data.onAir, place: placeName(place, t) }),
        t => t('{n, plural, one {One public camera} other {# public cameras}} in and around {city} on one live map, from road authorities, cities and webcam networks. Click one to watch.', { n: data.onAir, city: name(t) }),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: t('Live cameras in {city}', { city: placeName(place, t) }),
      lede: top.length
        ? t(wordingOf(place, 'lede', [msg('{n, plural, one {One camera} other {# cameras}} within {km, radius} of the centre of {city}, most of them from {sources}. TAKIP pins them on one map, so you can look at a street or a road as it is now.'), msg('{n, plural, one {One public camera} other {# public cameras}} within {km, radius} of the centre of {city}, mostly from {sources}, each pinned where it stands. Open one to see the street or road as it is now.'), msg('Within {km, radius} of the centre of {city}, {n, plural, one {one camera is} other {# cameras are}} on the map, most of them from {sources}. Pick one to look at its street or road right now.')]), { n: data.onAir, km: data.km, city: name(t), sources: listOf(top, t) })
        : t(wordingOf(place, 'lede', [msg('{n, plural, one {One camera} other {# cameras}} within {km, radius} of the centre of {city}. TAKIP pins them on one map, so you can look at a street or a road as it is now.'), msg('{n, plural, one {One public camera} other {# public cameras}} within {km, radius} of the centre of {city}, each pinned where it stands. Open one to see the street or road as it is now.'), msg('Within {km, radius} of the centre of {city}, {n, plural, one {one camera is} other {# cameras are}} on the map. Pick one to look at its street or road right now.')]), { n: data.onAir, km: data.km, city: name(t) }),
    };
  },

  summary(place, { data }, t) {
    if (!data.onAir) return t('{n, plural, one {One camera listed, off air.} other {# cameras listed, all off air.}}', { n: data.offAir });
    const named = data.sources.slice(0, 3).map(([s]) => s);
    const sources = named.length && data.others ? [...named, t('others')] : named;
    return sources.length
      ? t('{n, plural, one {One camera} other {# cameras}}, from {sources}.', { n: data.onAir, sources: listOf(sources, t) })
      : t('{n, plural, one {One camera} other {# cameras}} on the map.', { n: data.onAir });
  },

  // Where the map draws cameras as pictures; a country's overview passes no page.
  open: (_place, page?: TopicPage<CamerasData>) => {
    const at = page?.data.tileAt;
    return at ? { layers: ['cctv', 'cctv_previews'], view: { lat: at[1], lon: at[0], zoom: CAMERA_TILE_ZOOM } } : { layers: ['cctv', 'cctv_previews'], zoom: 11 };
  },
  openLabel: msg('See them on the live map'),
};

export type CamerasPage = TopicPage<CamerasData>;

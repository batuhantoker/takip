import { msg } from '@/lib/core/i18n/translator';
import type { ViewModeLink } from '@/lib/map/view-mode-link';
import { DEEP_SKY, deepSkyObject, type DeepSkyObject } from '@/lib/space/deep/deep-sky';
import type { SkyKey } from '@/lib/space/sky';
import type { SpaceFocus } from '@/lib/space/worlds';
import type { LiveImageId } from '../live-images';
import { mapHref } from '../map-link';

/**
 * TAKIP — the way out from the map to the edge of the observable universe, as stops the space pages show in order:
 * each with a picture, how far it is (measured now for the bodies and craft JPL Horizons places) and a link that
 * opens the 3D view there.
 */

export type StopPicture =
  | { kind: 'live'; id: LiveImageId }
  /** `fill` crops a star field to the frame; globes and craft stay whole. */
  | { kind: 'wiki'; title: string; fill?: boolean }
  | { kind: 'deep'; id: string }
  | { kind: 'file'; src: string; credit: string; illustration?: boolean };

export interface JourneyStop {
  id: string;
  name: string;
  line: string;
  picture: StopPicture;
  /** Measured now, from Earth. */
  live?: { kind: 'body'; key: SkyKey } | { kind: 'craft'; id: number };
  /** Catalogued, from the Sun. */
  ly?: number;
  mode: ViewModeLink;
  /** Our own page about it, and the words that link it. */
  page?: { path: string; label: string };
}

const space = (focus: SpaceFocus, select?: Extract<ViewModeLink, { view: 'space' }>['select']): ViewModeLink =>
  ({ view: 'space', focus, ...(select ? { select } : {}) });

const DEEP_FOCUS: Record<DeepSkyObject['realm'], SpaceFocus> = { 'milky-way': 'stars', 'local-group': 'galaxy', beyond: 'universe' };

/** The 3D view opened on a deep-sky picture; the Local Group galaxies are selected under their own feature. */
export const deepSkyMode = (d: DeepSkyObject): ViewModeLink => space(DEEP_FOCUS[d.realm], { kind: 'feature', id: d.feature ?? d.id });
export const deepSkyHref = (d: DeepSkyObject) => mapHref({ layers: [], mode: deepSkyMode(d) });
export const stopHref = (s: JourneyStop) => mapHref({ layers: [], mode: s.mode });

function deep(id: string, line: string): JourneyStop[] {
  const d = deepSkyObject(id);
  return d ? [{ id, name: d.name, line, picture: { kind: 'deep', id }, ly: d.ly, mode: deepSkyMode(d) }] : [];
}

export const NEAREST_STARS: JourneyStop = {
  id: 'alpha-centauri', name: msg('Alpha Centauri'), picture: { kind: 'wiki', title: 'Alpha Centauri', fill: true }, ly: 4.25, mode: space('stars'),
  line: msg('The nearest stars. Out here the painted sky gives way to real stars, each at its own distance, and the constellations come apart.'),
};

export const SOLAR_JOURNEY: JourneyStop[] = [
  { id: 'earth', name: msg('Earth'), picture: { kind: 'live', id: 'earth' }, mode: space('earth'),
    line: msg('Where the map is. Zoom out past the whole globe and it hands over to space without a cut.') },
  { id: 'moon', name: msg('Moon'), picture: { kind: 'wiki', title: 'Moon' }, live: { kind: 'body', key: 'moon' }, mode: space('moon'), page: { path: '/map/moon-3d', label: msg('The Moon in 3D') },
    line: msg('Every landing site, the rovers’ tracks and the orbiters circling it right now.') },
  { id: 'sun', name: msg('Sun'), picture: { kind: 'live', id: 'sun' }, live: { kind: 'body', key: 'sun' }, mode: space('sun'), page: { path: '/map/sun-live', label: msg('The Sun today') },
    line: msg('Wrapped in today’s frame from NASA’s Solar Dynamics Observatory.') },
  { id: 'mars', name: msg('Mars'), picture: { kind: 'wiki', title: 'Mars' }, live: { kind: 'body', key: 'mars' }, mode: space('mars'), page: { path: '/planet/mars', label: msg('Mars right now') },
    line: msg('Two rovers are driving on it; their whole routes are drawn on the globe.') },
  { id: 'voyager-1', name: 'Voyager 1', picture: { kind: 'wiki', title: 'Voyager 1' }, live: { kind: 'craft', id: -31 }, page: { path: '/spacecraft/voyager-1', label: msg('Where Voyager 1 is now') },
    mode: space('solar', { kind: 'craft', id: -31 }),
    line: msg('The farthest spacecraft, launched in 1977 and outside the Sun’s bubble since 2012. Its flight can be replayed from the launch pad.') },
  NEAREST_STARS,
];

export const DEEP_JOURNEY: JourneyStop[] = [
  NEAREST_STARS,
  ...deep('pleiades', msg('Seven stars to the eye, a thousand in the cluster, still wrapped in the dust they are passing through.')),
  ...deep('orion-nebula', msg('The nearest place where big stars are being born, the smudge in Orion’s sword.')),
  ...deep('pillars-of-creation', msg('Columns of gas four light-years tall where stars are being born, in Webb’s infrared picture.')),
  ...deep('sgr-a-shadow', msg('The black hole at the centre of the Milky Way, in the Event Horizon Telescope’s picture.')),
  { id: 'milky-way', name: msg('Milky Way'), picture: { kind: 'file', src: '/data/sky/milky-way-face-on.jpg', credit: 'NASA/JPL-Caltech/R. Hurt (SSC/Caltech)', illustration: true },
    ly: 100_000, mode: space('galaxy'),
    line: msg('Our galaxy from outside, which no one has seen: the disc is an artist’s map, placed so its Sun and centre land on the real ones.') },
  ...deep('lmc', msg('The biggest of the Milky Way’s satellite galaxies, with the Tarantula Nebula glowing in it.')),
  ...deep('m31', msg('The farthest thing you can see with your own eyes. It is falling toward us.')),
  ...deep('whirlpool-galaxy', msg('A spiral pulling its small companion apart, face-on to us.')),
  ...deep('m87-shadow', msg('The first picture ever taken of a black hole, 6.5 billion times the Sun’s mass.')),
  ...deep('stephans-quintet', msg('Four galaxies in a slow collision, in one of Webb’s first pictures.')),
  ...deep('webb-first-deep-field', msg('A galaxy cluster bending the light of galaxies far behind it into arcs.')),
  { id: 'cmb', name: msg('Cosmic microwave background'), picture: { kind: 'file', src: '/data/cosmos/cmb.jpg', credit: 'ESA and the Planck Collaboration' },
    ly: 45.3e9, mode: space('universe', { kind: 'feature', id: 'cmb' }),
    line: msg('The oldest light there is, from 380,000 years after the Big Bang. Nothing beyond it can be seen.') },
];

const IN_JOURNEY = new Set(DEEP_JOURNEY.map(s => s.id));

/** The pictures the deep journey leaves out, by realm, most famous first. */
export function deepSkyRest(): { realm: DeepSkyObject['realm']; items: DeepSkyObject[] }[] {
  return (['milky-way', 'local-group', 'beyond'] as const).map(realm => ({
    realm,
    items: DEEP_SKY.filter(d => d.realm === realm && !IN_JOURNEY.has(d.id)).sort((a, b) => b.rank - a.rank),
  }));
}

/** The best-known pictures, for a page that only points onward. */
export const DEEP_SKY_TEASER = ['pillars-of-creation', 'orion-nebula', 'crab-nebula', 'm31', 'whirlpool-galaxy', 'webb-first-deep-field'];

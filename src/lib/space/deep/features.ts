/**
 * TAKIP — what the space view shows past the planets that is not a body with
 * an ephemeris: model shells, distance markers, the galactic centre and the
 * nearby galaxies. Models are flagged so the view can label them illustrations.
 */

import { msg, type Translate, type Vars } from '@/lib/core/i18n/translator';
import { LY_KM, scale } from '../astro';
import { compact } from '../format';
import { bodyDirection, EQUATORIAL_TO_ECLIPTIC, mul } from '../frames';
import { GALACTIC_CENTRE_KM } from './galaxy';
import type { Vec3 } from '../horizons';

export interface DeepFeature {
  id: string;
  name: string;
  subtitle: string;
  subtitleVars?: Vars;
  /** A model drawn to show the idea, not a measurement. */
  illustration: boolean;
  note: string;
  /** A second sentence after the note. */
  footnote?: string;
  fields?: (t: Translate) => [string, string][];
  /** Fixed scene position, km, for things the camera can fly to. */
  position?: Vec3;
  radiusKm?: number;
  credit?: string;
}

/** Hand-curated from NED: J2000 RA/Dec (degrees), distance and diameter in light-years. */
export interface NearbyGalaxy { id: string; name: string; ra: number; dec: number; ly: number; diameterLy: number; kind: string; note: string }

export const NEARBY_GALAXIES: NearbyGalaxy[] = [
  { id: 'lmc', name: msg('Large Magellanic Cloud'), ra: 80.894, dec: -69.756, ly: 163_000, diameterLy: 32_000, kind: msg('Satellite of the Milky Way'), note: msg('Visible to the naked eye from the southern hemisphere; SN 1987A went off in it.') },
  { id: 'smc', name: msg('Small Magellanic Cloud'), ra: 13.187, dec: -72.829, ly: 203_000, diameterLy: 19_000, kind: msg('Satellite of the Milky Way'), note: msg('Bound to the Large Magellanic Cloud by a bridge of gas and stars.') },
  { id: 'sgr-dsph', name: msg('Sagittarius Dwarf'), ra: 283.764, dec: -30.48, ly: 65_000, diameterLy: 10_000, kind: msg('Satellite of the Milky Way'), note: msg('Being torn apart by the Milky Way on the far side of the galactic centre; its stream wraps the sky.') },
  { id: 'draco', name: msg('Draco Dwarf'), ra: 260.052, dec: 57.915, ly: 260_000, diameterLy: 2_700, kind: msg('Satellite of the Milky Way'), note: msg('One of the faintest galaxies known, almost all dark matter.') },
  { id: 'ursa-minor', name: msg('Ursa Minor Dwarf'), ra: 227.285, dec: 67.223, ly: 200_000, diameterLy: 1_900, kind: msg('Satellite of the Milky Way'), note: msg('Old stars only; it stopped forming new ones billions of years ago.') },
  { id: 'sculptor', name: msg('Sculptor Dwarf'), ra: 15.039, dec: -33.709, ly: 280_000, diameterLy: 3_000, kind: msg('Satellite of the Milky Way'), note: msg('The first dwarf spheroidal galaxy found, by Harlow Shapley in 1937.') },
  { id: 'carina', name: msg('Carina Dwarf'), ra: 100.403, dec: -50.966, ly: 330_000, diameterLy: 1_600, kind: msg('Satellite of the Milky Way'), note: msg('Formed its stars in separate bursts billions of years apart.') },
  { id: 'fornax', name: msg('Fornax Dwarf'), ra: 39.997, dec: -34.449, ly: 460_000, diameterLy: 3_200, kind: msg('Satellite of the Milky Way'), note: msg('Has six globular clusters of its own.') },
  { id: 'leo-i', name: 'Leo I', ra: 152.117, dec: 12.306, ly: 820_000, diameterLy: 2_000, kind: msg('Satellite of the Milky Way'), note: msg('Sits a third of a degree from Regulus, which makes it hard to see.') },
  { id: 'ngc-6822', name: msg("Barnard's Galaxy"), ra: 296.24, dec: -14.803, ly: 1_630_000, diameterLy: 7_000, kind: msg('Local Group dwarf irregular'), note: msg('NGC 6822, found by E. E. Barnard in 1884.') },
  { id: 'ic-10', name: 'IC 10', ra: 5.072, dec: 59.304, ly: 2_200_000, diameterLy: 5_000, kind: msg('Satellite of Andromeda'), note: msg('The nearest starburst galaxy, seen through the Milky Way\'s disc.') },
  { id: 'ic-1613', name: 'IC 1613', ra: 16.199, dec: 2.118, ly: 2_380_000, diameterLy: 10_000, kind: msg('Local Group dwarf irregular'), note: msg('Almost free of dust, so its stars are measured cleanly.') },
  { id: 'm31', name: msg('Andromeda Galaxy'), ra: 10.685, dec: 41.269, ly: 2_537_000, diameterLy: 152_000, kind: msg('Spiral galaxy, M31'), note: msg('The largest galaxy in the Local Group and the most distant thing the naked eye can see. It is falling toward the Milky Way.') },
  { id: 'm32', name: 'M32', ra: 10.674, dec: 40.865, ly: 2_490_000, diameterLy: 6_500, kind: msg('Satellite of Andromeda'), note: msg('A compact elliptical galaxy in front of Andromeda\'s disc.') },
  { id: 'm110', name: 'M110', ra: 10.092, dec: 41.685, ly: 2_690_000, diameterLy: 17_000, kind: msg('Satellite of Andromeda'), note: msg('NGC 205, a dwarf elliptical with a little recent star formation.') },
  { id: 'm33', name: msg('Triangulum Galaxy'), ra: 23.462, dec: 30.66, ly: 2_730_000, diameterLy: 61_000, kind: msg('Spiral galaxy, M33'), note: msg('The third-largest galaxy in the Local Group.') },
  { id: 'wlm', name: 'Wolf–Lundmark–Melotte', ra: 0.4925, dec: -15.461, ly: 3_040_000, diameterLy: 8_000, kind: msg('Local Group dwarf irregular'), note: msg('Alone on the group\'s outskirts.') },
];

export function galaxyPosition(g: NearbyGalaxy): Vec3 {
  return scale(mul(EQUATORIAL_TO_ECLIPTIC, bodyDirection(g.dec, g.ra)), g.ly * LY_KM);
}

const ly = (n: number, t: Translate) => `${n.toLocaleString(t.intl)} ly`;

export const DEEP_FEATURES: Record<string, DeepFeature> = {
  'termination-shock': {
    id: 'termination-shock', name: msg('Termination shock'), subtitle: msg('Heliosphere · model'), illustration: true,
    note: msg('Where the solar wind drops below the speed of sound as it meets the interstellar medium. Voyager 1 crossed it in December 2004 at 94 AU, Voyager 2 in August 2007 at 84 AU. The surface here is a model fitted through those two crossings.'),
  },
  heliopause: {
    id: 'heliopause', name: msg('Heliopause'), subtitle: msg('Heliosphere · model'), illustration: true,
    note: msg("The edge of the Sun's bubble, where the solar wind gives way to interstellar gas. Voyager 1 crossed it on 2012-08-25 at 121.6 AU and Voyager 2 on 2018-11-05 at 119 AU. Its shape, nose into the interstellar wind and a tail behind, is a model fitted through those crossings."),
  },
  'kuiper-belt': {
    id: 'kuiper-belt', name: msg('Kuiper belt and scattered disc'), subtitle: msg('Minor Planet Center orbits'), illustration: false,
    note: msg('Every centaur and trans-Neptunian object the Minor Planet Center has an orbit for, each placed where its orbit puts it today. Thousands more are too faint to have been found yet.'),
  },
  'gravitational-focus': {
    id: 'gravitational-focus', name: msg('Solar gravitational focus'), subtitle: '550 AU', illustration: false,
    note: msg("The Sun's gravity bends starlight to a focus from about 550 AU outward, on the far side from whatever is being looked at. A telescope there could image an exoplanet's surface."),
  },
  'oort-cloud': {
    id: 'oort-cloud', name: msg('Oort cloud'), subtitle: msg('Illustration'), illustration: true,
    note: msg('A shell of icy bodies thought to reach from about 2,000 AU to 100,000 AU, flattened near the planets and round further out. No object has been seen in it; it is inferred from long-period comets. The dots here are random, not real objects.'),
  },
  'light-day': { id: 'light-day', name: msg('One light-day'), subtitle: msg('{n} AU from the Sun'), subtitleVars: { n: 173 }, illustration: false, note: msg('Light from the Sun takes a day to get this far. Voyager 1 passes one light-day from Earth in late 2026.') },
  'light-week': { id: 'light-week', name: msg('One light-week'), subtitle: msg('{n} AU from the Sun'), subtitleVars: { n: 1212 }, illustration: false, note: msg('Light from the Sun takes a week to get this far.') },
  'light-month': { id: 'light-month', name: msg('One light-month'), subtitle: msg('{n} AU from the Sun'), subtitleVars: { n: 5194 }, illustration: false, note: msg('Light from the Sun takes thirty days to get this far.') },
  'light-year': { id: 'light-year', name: msg('One light-year'), subtitle: msg('{n} AU from the Sun'), subtitleVars: { n: 63_241 }, illustration: false, note: msg('About a quarter of the way to the nearest star, Proxima Centauri, 4.25 light-years away.') },
  'sgr-a': {
    id: 'sgr-a', name: 'Sagittarius A*', subtitle: msg('Black hole at the galactic centre'), illustration: false,
    fields: t => [[t('From the Sun'), ly(26_670, t)], [t('Mass'), t('{mass} Suns', { mass: compact(4.3e6, t.intl, 1) })]],
    note: msg('The supermassive black hole at the centre of the Milky Way, its mass weighed from the orbits of the stars around it (GRAVITY Collaboration). Its direction is the origin of galactic coordinates.'),
    position: GALACTIC_CENTRE_KM, radiusKm: 300 * LY_KM,
  },
  'milky-way': {
    id: 'milky-way', name: msg('Milky Way'), subtitle: msg('Our galaxy · illustration'), illustration: true,
    fields: t => [
      [t('Stars'), new Intl.NumberFormat(t.intl, { notation: 'compact', compactDisplay: 'long' }).formatRange(100e9, 400e9)],
      [t('Disc'), t('about {n} ly', { n: 100_000 })],
    ],
    note: msg("A barred spiral seen from outside, which no one has done: the disc is NASA/JPL-Caltech/R. Hurt's artwork, drawn from Spitzer surveys and placed so its Sun and centre fall on the real ones. Positions inside it are approximate."),
    credit: 'NASA/JPL-Caltech/R. Hurt (SSC/Caltech)',
    position: GALACTIC_CENTRE_KM, radiusKm: 2_000 * LY_KM,
  },
  cmb: {
    id: 'cmb', name: msg('Cosmic microwave background'), subtitle: msg('The edge of the observable universe'), illustration: false,
    fields: t => [
      [t('Distance now'), `${compact(45.3e9, t.intl, 1)} ly`], [t('Light left'), t('{amount} years ago', { amount: compact(13.8e9, t.intl, 1) })],
      [t('Temperature'), `${(2.725).toLocaleString(t.intl)} K`], [t('Map'), t('NASA WMAP, {n} years', { n: 9 })],
    ],
    note: msg("The oldest light there is, released 380,000 years after the Big Bang when the universe first became transparent. Its source has since been carried 45 billion light-years away by the expansion. The map is WMAP's, the shell around the Sun is where that light comes from; nothing beyond it can be seen. Seen from outside, the sphere is a picture of our own horizon, not a place."),
    credit: 'NASA / WMAP Science Team; LAMBDA, NASA GSFC',
  },
  ...Object.fromEntries(NEARBY_GALAXIES.map(g => [g.id, {
    id: g.id, name: g.name, subtitle: g.kind, illustration: false,
    fields: t => [
      [t('From the Sun'), g.ly >= 1e6 ? `${compact(g.ly, t.intl)} ly` : ly(g.ly, t)],
      [t('Across'), t('about {n} ly', { n: g.diameterLy })], [t('RA / Dec'), `${g.ra.toFixed(2)}° / ${g.dec.toFixed(2)}°`],
    ],
    note: g.note,
    footnote: msg('Position and distance from NED; the glow is drawn to its size, not imaged.'),
    position: galaxyPosition(g), radiusKm: (g.diameterLy / 2) * LY_KM,
  } satisfies DeepFeature])),
};

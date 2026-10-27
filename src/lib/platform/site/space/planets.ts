import type { SkyKey } from '@/lib/space/sky';
import type { SpaceFocus } from '@/lib/space/worlds';

/** TAKIP — the planets (and Pluto) with a public page at /planet/<key>. The Moon and the Sun keep their /map pages. */

export type PlanetKey = Extract<SkyKey, 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto'>;

export interface PlanetEntry {
  key: PlanetKey;
  /** English Wikipedia title. */
  wiki: string;
  /** The space view's own stop for it; the rest are reached from the solar system. */
  focus: SpaceFocus;
  /** The /map page about its 3D globe, where there is one. */
  layerPage?: string;
}

export const PLANETS: PlanetEntry[] = [
  { key: 'mercury', wiki: 'Mercury (planet)', focus: 'solar' },
  { key: 'venus', wiki: 'Venus', focus: 'solar' },
  { key: 'mars', wiki: 'Mars', focus: 'mars', layerPage: 'mars-3d' },
  { key: 'jupiter', wiki: 'Jupiter', focus: 'solar' },
  { key: 'saturn', wiki: 'Saturn', focus: 'solar' },
  { key: 'uranus', wiki: 'Uranus', focus: 'solar' },
  { key: 'neptune', wiki: 'Neptune', focus: 'solar' },
  { key: 'pluto', wiki: 'Pluto', focus: 'solar' },
];

export const planetEntry = (key: string) => PLANETS.find(p => p.key === key) ?? null;

export const planetPath = (p: { key: string }) => `/planet/${p.key}`;

/** The dwarf planets past Neptune and the interstellar visitors the space view draws, each with a page at /planet/<key>. */
export interface OuterEntry {
  key: string;
  kind: 'dwarf' | 'visitor';
  /** English Wikipedia title. */
  wiki: string;
}

export const OUTER_BODIES: OuterEntry[] = [
  { key: 'eris', kind: 'dwarf', wiki: 'Eris (dwarf planet)' },
  { key: 'haumea', kind: 'dwarf', wiki: 'Haumea' },
  { key: 'makemake', kind: 'dwarf', wiki: 'Makemake' },
  { key: 'gonggong', kind: 'dwarf', wiki: 'Gonggong (dwarf planet)' },
  { key: 'quaoar', kind: 'dwarf', wiki: 'Quaoar' },
  { key: 'sedna', kind: 'dwarf', wiki: 'Sedna (dwarf planet)' },
  { key: 'orcus', kind: 'dwarf', wiki: 'Orcus (dwarf planet)' },
  { key: 'oumuamua', kind: 'visitor', wiki: '1I/ʻOumuamua' },
  { key: 'borisov', kind: 'visitor', wiki: '2I/Borisov' },
  { key: 'atlas', kind: 'visitor', wiki: '3I/ATLAS' },
];

export const outerEntry = (key: string) => OUTER_BODIES.find(p => p.key === key) ?? null;

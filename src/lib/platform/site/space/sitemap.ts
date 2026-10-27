import type { Locale } from '@/lib/core/i18n/locales';
import { OUTER_BODIES, planetPath, PLANETS } from './planets';
import { craftPath, ROSTER } from './roster';
import { SKY_INDEX_PATH, SKY_PAGES, skyPath } from './sky-pages';
import { STRUCTURE_PAGES } from './structure-pages';

/** Every space page's English path: the spacecraft index, each craft and each planet, the deep-sky pictures and structures. */
export const spacePaths = () => [
  '/spacecraft', ...PLANETS.map(planetPath), ...OUTER_BODIES.map(planetPath), ...ROSTER.map(craftPath), SKY_INDEX_PATH, ...SKY_PAGES.map(p => skyPath(p.object.id)), ...STRUCTURE_PAGES.map(p => skyPath(p.id)),
];

/** A space page's share card, drawn by /og in its language. */
export const spaceImage = (kind: 'craft' | 'planet' | 'index' | 'sky', slug: string, locale: Locale) =>
  `/og?space=${kind}:${encodeURIComponent(slug)}&lang=${locale}`;

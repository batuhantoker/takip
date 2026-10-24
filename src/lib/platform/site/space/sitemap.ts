import type { Locale } from '@/lib/core/i18n/locales';
import { planetPath, PLANETS } from './planets';
import { craftPath, ROSTER } from './roster';

/** Every space page's English path: the spacecraft index, each craft and each planet. */
export const spacePaths = () => ['/spacecraft', ...PLANETS.map(planetPath), ...ROSTER.map(craftPath)];

/** A space page's share card, drawn by /og in its language. */
export const spaceImage = (kind: 'craft' | 'planet' | 'index', slug: string, locale: Locale) =>
  `/og?space=${kind}:${encodeURIComponent(slug)}&lang=${locale}`;

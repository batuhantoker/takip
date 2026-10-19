import { mapHref } from '../map-link';
import { GPS_JAMMING } from './entries/gps-jamming';
import type { Guide } from './types';

export type { Guide, GuideSection } from './types';

/** Every guide, in the order the index lists them. One file each in ./entries. */
export const GUIDES: readonly Guide[] = [GPS_JAMMING];

/** Guides this server can back: one about a layer that needs a key the server lacks would describe a hidden layer. */
export const availableGuides = (env: Record<string, string | undefined> = process.env) =>
  GUIDES.filter(g => !g.requiresEnv || !!env[g.requiresEnv]?.trim());

export const guideBySlug = (slug: string, env: Record<string, string | undefined> = process.env) =>
  availableGuides(env).find(g => g.slug === slug);

export const guidePath = (guide: Guide) => `/guides/${guide.slug}`;

export const guideOpenPath = (guide: Guide, view = guide.open.view) =>
  mapHref({ layers: guide.open.layers, view, track: guide.open.track, mode: guide.open.mode, panel: guide.open.panel });

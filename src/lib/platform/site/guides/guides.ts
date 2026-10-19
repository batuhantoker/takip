import { mapHref } from '../map-link';
import { AURORA_FORECAST } from './entries/aurora-forecast';
import { BUSES_AND_TRAINS } from './entries/buses-and-trains';
import { GPS_JAMMING } from './entries/gps-jamming';
import { RADAR_OR_MODEL } from './entries/radar-or-model';
import { READ_A_METAR } from './entries/read-a-metar';
import { TRACK_A_FLIGHT } from './entries/track-a-flight';
import { TRACK_SHIPS } from './entries/track-ships';
import { TURKEY_EARTHQUAKES } from './entries/turkey-earthquakes';
import { WHERE_IS_THE_ISS } from './entries/where-is-the-iss';
import { WORLD_1914 } from './entries/world-1914';
import { WW2_BORDERS } from './entries/ww2-borders';
import type { Guide } from './types';

export type { Guide, GuideSection } from './types';

/** Every guide, in the order the index lists them. One file each in ./entries. */
export const GUIDES: readonly Guide[] = [
  TRACK_A_FLIGHT, BUSES_AND_TRAINS, TRACK_SHIPS, WHERE_IS_THE_ISS,
  GPS_JAMMING, READ_A_METAR, RADAR_OR_MODEL, AURORA_FORECAST,
  WORLD_1914, WW2_BORDERS, TURKEY_EARTHQUAKES,
];

/** Guides this server can back: one about a layer that needs a key the server lacks would describe a hidden layer. */
export const availableGuides = (env: Record<string, string | undefined> = process.env) =>
  GUIDES.filter(g => !g.requiresEnv || !!env[g.requiresEnv]?.trim());

export const guideBySlug = (slug: string, env: Record<string, string | undefined> = process.env) =>
  availableGuides(env).find(g => g.slug === slug);

export const guidePath = (guide: Guide) => `/guides/${guide.slug}`;

export const guideOpenPath = (guide: Guide, view = guide.open.view) =>
  mapHref({ layers: guide.open.layers, view, track: guide.open.track, mode: guide.open.mode, panel: guide.open.panel });

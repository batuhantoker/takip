import { AIR } from './catalog/air';
import { CAMERAS } from './catalog/cameras';
import { GROUND } from './catalog/ground';
import { HAZARDS } from './catalog/hazards';
import { NETWORK } from './catalog/network';
import { PAST } from './catalog/past';
import { SEA } from './catalog/sea';
import { SPACE } from './catalog/space';
import { SPACE_VIEW } from './catalog/space-view';
import { TOOLS } from './catalog/tools';
import type { LayerPage, SectionId } from './catalog/types';
import { WEATHER } from './catalog/weather';
import { WORLD } from './catalog/world';
import { mapHref, type MapView } from './map-link';

export type { LayerPage, SectionId } from './catalog/types';

export const SECTIONS: { id: SectionId; label: string; blurb: string }[] = [
  { id: 'air', label: 'In the air', blurb: 'Aircraft from ADS-B receivers, airports and the airspace around them.' },
  { id: 'sea', label: 'At sea', blurb: 'Ships from AIS, and the straits and canals they squeeze through.' },
  { id: 'space', label: 'In space', blurb: 'Satellites, the ISS, rocket launches and the aurora.' },
  { id: 'weather', label: 'Weather', blurb: 'Radar, wind, temperature, lightning and the Earth from weather satellites.' },
  { id: 'hazards', label: 'Hazards', blurb: 'Earthquakes, wildfires, storms, radiation and disease outbreaks.' },
  { id: 'cameras', label: 'Cameras and streams', blurb: 'Public cameras and live news streams, pinned where they are.' },
  { id: 'ground', label: 'On the ground', blurb: 'Road traffic, buses and trains, and trails.' },
  { id: 'world', label: 'World events', blurb: 'News as it is reported, air-raid alerts and the places that matter in a crisis.' },
  { id: 'network', label: 'The internet', blurb: 'Outages, attacks, malware and the cables that carry it all.' },
  { id: 'past', label: 'Back in time', blurb: 'Replay recorded traffic, travel through history, and watch the continents drift.' },
  { id: 'tools', label: 'Tools', blurb: 'Draw areas, plan routes, look things up and ask TI about what is on the map.' },
];

export const LAYER_PAGES: readonly LayerPage[] = [
  ...AIR, ...SEA, ...SPACE, ...SPACE_VIEW, ...WEATHER, ...HAZARDS, ...CAMERAS, ...GROUND, ...WORLD, ...NETWORK, ...PAST, ...TOOLS,
];

/** Pages this server can back: a page whose layer needs a key the server lacks would promise a layer that isn't there. */
export function availablePages(env: Record<string, string | undefined> = process.env): LayerPage[] {
  return LAYER_PAGES.filter(p => !p.requiresEnv || !!env[p.requiresEnv]?.trim());
}

export function layerPage(slug: string, env: Record<string, string | undefined> = process.env): LayerPage | undefined {
  return availablePages(env).find(p => p.slug === slug);
}

export const pagePath = (page: LayerPage) => `/map/${page.slug}`;

/** "Open on the map": the page's layers at `view` (its own view by default). */
export const openPath = (page: LayerPage, view: MapView | undefined = page.view) =>
  mapHref({ layers: page.layers, view, track: page.track, mode: page.mode, panel: page.panel });

export const sectionOf = (id: SectionId) => SECTIONS.find(s => s.id === id)!;

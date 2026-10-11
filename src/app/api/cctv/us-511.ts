import type { CctvCamera } from './types';
import { loadIbi511Cameras, type Ibi511Source } from './ibi511';
import { loadCarsCameras, type Bounds, type CarsSource } from './cars';

/**
 * OSIRIS — state DOTs on a shared 511 platform. Adding one is adding an entry here: the region, its map box and its
 * fetcher all come from it. Each `bounds` drops mis-geocoded rows and is also the box the region loads for.
 */

export interface StateFeed {
  region: string;
  idPrefix: string;
  bounds: Bounds;
  fetch: () => Promise<CctvCamera[]>;
}

const ibi = (region: string, cfg: Ibi511Source): StateFeed =>
  ({ region, idPrefix: cfg.idPrefix, bounds: cfg.bounds, fetch: () => loadIbi511Cameras(cfg) });

const cars = (region: string, cfg: CarsSource): StateFeed =>
  ({ region, idPrefix: cfg.idPrefix, bounds: cfg.bounds, fetch: () => loadCarsCameras(cfg) });

export const STATE_FEEDS: StateFeed[] = [
  // IBI 511 — the deployments ./florida, ./georgia, ./northcarolina and ./arizona also run on.
  ibi('pennsylvania', {
    base: 'https://511pa.com', idPrefix: 'penndot', source: 'PennDOT', state: 'Pennsylvania',
    bounds: { minLat: 39.6, maxLat: 42.4, minLng: -80.6, maxLng: -74.6 },
    videoHosts: [],
  }),
  ibi('wisconsin', {
    base: 'https://511wi.gov', idPrefix: 'wisdot', source: 'WisDOT', state: 'Wisconsin',
    bounds: { minLat: 42.4, maxLat: 47.4, minLng: -92.95, maxLng: -86.7 },
    // Three Mississippi ferry rows point at an Iowa DOT edge that answers 204.
    videoHosts: ['cctv1.dot.wi.gov', 'cctv2.dot.wi.gov'],
  }),
  ibi('idaho', {
    base: 'https://511.idaho.gov', idPrefix: 'itd', source: 'ITD', state: 'Idaho',
    // Also lists northern Nevada, which ./nevada carries.
    bounds: { minLat: 41.9, maxLat: 49.1, minLng: -117.3, maxLng: -110.9 },
  }),
  ibi('newengland', {
    base: 'https://newengland511.org', idPrefix: 'ne511', source: 'New England 511', state: 'New England',
    bounds: { minLat: 42.6, maxLat: 47.5, minLng: -73.5, maxLng: -66.8 },
  }),
  ibi('alaska', {
    base: 'https://511.alaska.gov', idPrefix: 'akdot', source: 'Alaska DOT&PF', state: 'Alaska',
    bounds: { minLat: 51, maxLat: 71.6, minLng: -180, maxLng: -129.9 },
  }),

  // CARS 511 — the platform ./indiana runs on.
  cars('minnesota', {
    host: '511mn.org', idPrefix: 'mndot', source: 'MnDOT', state: 'Minnesota',
    bounds: { minLat: 43.4, maxLat: 49.4, minLng: -97.3, maxLng: -89.4 },
  }),
  cars('iowa', {
    host: '511ia.org', idPrefix: 'iowadot', source: 'Iowa DOT', state: 'Iowa',
    bounds: { minLat: 40.3, maxLat: 43.6, minLng: -96.7, maxLng: -90.1 },
  }),
  cars('kansas', {
    host: 'kandrive.gov', idPrefix: 'kdot', source: 'KDOT', state: 'Kansas',
    // KC Scout's Missouri-side cameras fall outside, and would be captioned Kansas.
    bounds: { minLat: 36.9, maxLat: 40.1, minLng: -102.1, maxLng: -94.5 },
  }),
  cars('nebraska', {
    host: '511.nebraska.gov', idPrefix: 'nedot', source: 'NDOT Nebraska', state: 'Nebraska',
    bounds: { minLat: 39.9, maxLat: 43.1, minLng: -104.1, maxLng: -95.3 },
  }),
];

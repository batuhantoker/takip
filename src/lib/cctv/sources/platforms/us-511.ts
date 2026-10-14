import type { CctvCamera } from '@/lib/cctv/types';
import { loadIbi511Cameras, type Ibi511Source } from './ibi511';
import { loadCarsCameras, type Bounds, type CarsSource } from './cars';
import { loadCars511xCameras, type Cars511xSource } from './cars511x';

/**
 * TAKIP — state DOTs on a shared 511 platform. Adding one is adding an entry here: the region, its map box and its
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

const x511 = (region: string, cfg: Cars511xSource): StateFeed =>
  ({ region, idPrefix: cfg.idPrefix, bounds: cfg.bounds, fetch: () => loadCars511xCameras(cfg) });

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
  // CTDOT's terms forbid redistribution or framing without its written consent: pending, not yet granted.
  ibi('connecticut', {
    base: 'https://ctroads.org', idPrefix: 'ctdot', source: 'CTDOT', state: 'Connecticut',
    bounds: { minLat: 40.95, maxLat: 42.1, minLng: -73.75, maxLng: -71.75 },
  }),
  // Nova Scotia allows personal and non-commercial use only.
  ibi('novascotia', {
    base: 'https://511.novascotia.ca', idPrefix: 'ns511', source: 'Nova Scotia 511', state: 'Nova Scotia', country: 'Canada',
    bounds: { minLat: 43.3, maxLat: 47.1, minLng: -66.5, maxLng: -59.6 },
  }),
  // MTO. `/api/v2/get/cameras` answers "Invalid Key" without a developer key; this list is the same cameras, keyless.
  ibi('ontario', {
    base: 'https://511on.ca', idPrefix: 'on', source: '511 Ontario', state: 'Ontario', country: 'Canada',
    // Its `county` column holds cities and regions ("Toronto", "Durham").
    countySuffix: '',
    bounds: { minLat: 41.6, maxLat: 57.0, minLng: -95.3, maxLng: -74.2 },
    // Same frames as the City of Toronto and ./york-region feeds.
    excludeOwners: ['City of Toronto', 'York Region'],
  }),
  ibi('newbrunswick', {
    base: 'https://511.gnb.ca', idPrefix: 'nb511', source: 'New Brunswick 511', state: 'New Brunswick', country: 'Canada',
    bounds: { minLat: 44.5, maxLat: 48.1, minLng: -69.1, maxLng: -63.7 },
  }),
  // The five below: terms pages render client-side and haven't been reviewed.
  ibi('saskatchewan', {
    base: 'https://hotline.gov.sk.ca', idPrefix: 'sk511', source: 'SK Highway Hotline', state: 'Saskatchewan', country: 'Canada',
    bounds: { minLat: 48.95, maxLat: 60.05, minLng: -110.05, maxLng: -101.3 },
  }),
  ibi('manitoba', {
    base: 'https://www.manitoba511.ca', idPrefix: 'mb511', source: 'Manitoba 511', state: 'Manitoba', country: 'Canada',
    bounds: { minLat: 48.95, maxLat: 60.05, minLng: -102.1, maxLng: -88.9 },
  }),
  ibi('newfoundland', {
    base: 'https://511nl.ca', idPrefix: 'nl511', source: '511 Newfoundland and Labrador', state: 'Newfoundland and Labrador', country: 'Canada',
    bounds: { minLat: 46.5, maxLat: 60.5, minLng: -67.9, maxLng: -52.5 },
  }),
  ibi('pei', {
    base: 'https://511.gov.pe.ca', idPrefix: 'pe511', source: '511 PEI', state: 'Prince Edward Island', country: 'Canada',
    bounds: { minLat: 45.9, maxLat: 47.1, minLng: -64.5, maxLng: -61.9 },
  }),
  ibi('yukon', {
    base: 'https://511yukon.ca', idPrefix: 'yt511', source: '511 Yukon', state: 'Yukon', country: 'Canada',
    // One Alaska Highway camera sits just south of 60°N in BC.
    bounds: { minLat: 59.5, maxLat: 69.7, minLng: -141.05, maxLng: -123.8 },
  }),
  ibi('alaska', {
    base: 'https://511.alaska.gov', idPrefix: 'akdot', source: 'Alaska DOT&PF', state: 'Alaska',
    bounds: { minLat: 51, maxLat: 71.6, minLng: -180, maxLng: -129.9 },
  }),

  // CARS 511 — the platform ./indiana runs on.
  cars('minnesota', {
    host: '511mn.org', idPrefix: 'mndot', source: 'MnDOT', state: 'Minnesota',
    bounds: { minLat: 43.4, maxLat: 49.4, minLng: -97.3, maxLng: -89.4 },
    videoHosts: ['video.dot.state.mn.us'],
  }),
  cars('iowa', {
    host: '511ia.org', idPrefix: 'iowadot', source: 'Iowa DOT', state: 'Iowa',
    bounds: { minLat: 40.3, maxLat: 43.6, minLng: -96.7, maxLng: -90.1 },
    videoHosts: ['video2.iowadot.gov', 'video3.iowadot.gov', 'video4.iowadot.gov'],
  }),
  cars('kansas', {
    host: 'kandrive.gov', idPrefix: 'kdot', source: 'KDOT', state: 'Kansas',
    bounds: { minLat: 36.9, maxLat: 40.1, minLng: -102.1, maxLng: -94.5 },
    // KC Scout's Missouri-side (`M…`) stills, which ../us/kcscout carries captioned Missouri rather than Kansas.
    excludeFeeds: /^https:\/\/www\.kcscout\.net\/TransSuite\.VCS\.CameraSnapshots\/M/,
  }),
  cars('massachusetts', {
    host: 'mass511.com', idPrefix: 'massdot', source: 'MassDOT', state: 'Massachusetts',
    bounds: { minLat: 41.2, maxLat: 42.9, minLng: -73.55, maxLng: -69.9 },
  }),
  cars('nebraska', {
    host: '511.nebraska.gov', idPrefix: 'nedot', source: 'NDOT Nebraska', state: 'Nebraska',
    bounds: { minLat: 39.9, maxLat: 43.1, minLng: -104.1, maxLng: -95.3 },
  }),
  // Spokane Regional Transportation Management Center. About 50 of these are the cameras WSDOT republishes as
  // stills under images.wsdot.wa.gov/spokane; they stay doubled because these copies add live video. Terms not reviewed.
  cars('spokane', {
    host: 'www.srtmc.org', idPrefix: 'srtmc', source: 'SRTMC Spokane', state: 'Spokane',
    bounds: { minLat: 47.3, maxLat: 48.2, minLng: -118.0, maxLng: -116.9 },
    // WSDOT's own stills, which ../us/wsdot carries.
    excludeFeeds: /^https:\/\/public\.carsprogram\.org\//,
    videoHosts: ['66ec3d11858f4.streamlock.net', '6719f5be90b00.streamlock.net'],
  }),

  // CARS 511x — Castle Rock's newer stack.
  x511('newyork', {
    api: 'https://api-511x-nysdot.carsprogram.org', idPrefix: 'nysdot', source: 'NYSDOT', state: 'New York',
    bounds: { minLat: 40.4, maxLat: 45.1, minLng: -79.8, maxLng: -71.7 },
    // ./nyc carries these from NYC DOT's own feed.
    excludeOwners: ['NYC DOT'],
  }),
  x511('colorado', {
    api: 'https://api-511x-co.carsprogram.org', idPrefix: 'cdot', source: 'CDOT', state: 'Colorado',
    bounds: { minLat: 36.95, maxLat: 41.05, minLng: -109.1, maxLng: -102.0 },
  }),
];

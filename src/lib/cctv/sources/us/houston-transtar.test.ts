import { describe, expect, it } from 'vitest';
import {
  fetchHoustonTranstarSites, mapTranstarSite, matchHoustonTranstarCameras, parseTranstarCameras, parseTranstarRoads, placeUnmatchedTranstar,
} from './houston-transtar';
import type { CctvCamera } from '@/lib/cctv/types';

const camera = (name: string): CctvCamera => ({
  id: `txdot-HOU-${name}`, lat: 29.765444, lng: -95.367628,
  name, city: 'Houston', country: 'US', source: 'TxDOT',
  feed_url: '/api/cctv/texas/snapshot?district=HOU&id=old',
  stream_type: 'jpg',
});

describe('Houston TranStar', () => {
  it('parses live roadway and camera links', () => {
    expect(parseTranstarRoads('<a href="?roadway=IH-45_North">I-45</a><a href="?roadway=IH-45_North">again</a>')).toEqual(['IH-45_North']);
    expect(parseTranstarCameras('IH-45_North', "<a href='?cam=Franklin&id=202'>Franklin</a>")).toEqual([
      { road: 'IH-45_North', name: 'Franklin', id: '202' },
    ]);
  });

  it('uses a unique exact roadway and intersection match without relabeling another location', () => {
    const listings = [
      { road: 'IH-45_North', name: 'Franklin', id: '202' },
      { road: 'IH-69_Eastex', name: 'Franklin', id: '999' },
    ];
    const result = matchHoustonTranstarCameras([
      camera('IH-45 North @ Franklin'),
      camera('IH-10 East @ Franklin'),
    ], listings);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'IH-45 North @ Franklin',
      source: 'Houston TranStar',
      feed_url: 'https://traffic.houstontranstar.org/snapshots/cctv/202.jpg',
      lat: 29.765444, lng: -95.367628,
    });
  });

  it('preserves Yoakum as the district for matched eastern Texas cameras', () => {
    const result = matchHoustonTranstarCameras([
      { ...camera('IH-10 West @ FM 1458'), city: 'Yoakum' },
    ], [{ road: 'IH-10_West', name: 'FM 1458', id: '364' }]);
    expect(result[0]).toMatchObject({ city: 'Yoakum', feed_url: 'https://traffic.houstontranstar.org/snapshots/cctv/364.jpg' });
  });

  it('drops ambiguous matches', () => {
    expect(matchHoustonTranstarCameras([camera('IH-45 North @ Franklin')], [
      { road: 'IH-45_North', name: 'Franklin', id: '202' },
      { road: 'IH-45_North', name: 'Franklin', id: '999' },
    ])).toEqual([]);
  });
});

// Verbatim attributes from the City of Houston's Trantar_Camera_Locations layer, 2026-10-12.
const SITE = { OBJECTID: 1, roadway: 'IH-45 Gulf', location: 'West Dallas', latitude: 29.757662, longitude: -95.374742, URL: 'http://www.houstontranstar.org/snapshots/cctv/102.jpg', cctv: '102', Name: 'IH-45 Gulf @ West Dallas' };

describe('Houston TranStar sites', () => {
  it('maps a GIS site', () => {
    expect(mapTranstarSite(SITE)).toEqual({ id: '102', name: 'IH-45 Gulf @ West Dallas', lat: 29.757662, lng: -95.374742 });
    expect(mapTranstarSite({ ...SITE, cctv: 'abc' })).toBeNull();
    expect(mapTranstarSite({ ...SITE, latitude: 0, longitude: 0 })).toBeNull();
  });

  it('places only listed cameras the join left out', () => {
    const joined = [{ ...camera('IH-45 North @ Franklin'), feed_url: 'https://traffic.houstontranstar.org/snapshots/cctv/202.jpg' }];
    const listings = [
      { road: 'IH-45_North', name: 'Franklin', id: '202' },
      { road: 'IH-45_Gulf', name: 'West Dallas', id: '102' },
    ];
    const sites = [
      { id: '202', name: 'IH-45 North @ Franklin', lat: 29.77, lng: -95.36 },
      { id: '102', name: 'IH-45 Gulf @ West Dallas', lat: 29.757662, lng: -95.374742 },
      { id: '108', name: 'Retired', lat: 29.7, lng: -95.4 },
    ];
    expect(placeUnmatchedTranstar(joined, listings, sites)).toEqual([{
      id: 'transtar-102', lat: 29.757662, lng: -95.374742, name: 'IH-45 Gulf @ West Dallas',
      city: 'Houston', country: 'US', source: 'Houston TranStar', stream_type: 'jpg',
      feed_url: 'https://traffic.houstontranstar.org/snapshots/cctv/102.jpg',
      external_url: 'https://traffic.houstontranstar.org/mobile/itranstar_cctv.aspx?roadway=IH-45_Gulf',
    }]);
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads the live Houston TranStar sites', async () => {
  const sites = await fetchHoustonTranstarSites();
  expect(sites.length).toBeGreaterThan(400);
  expect(new Set(sites.map(s => s.id)).size).toBeGreaterThan(400);
});

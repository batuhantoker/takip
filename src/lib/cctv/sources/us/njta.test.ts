import { describe, it, expect } from 'vitest';
import { mapNjtaCamera, parseNjtaPage, fetchNjtaCameras, NJTA_BOUNDS, type NjtaCamera } from './njta';

// Rows verbatim from njta.gov/travel-resources/camera-list/ (data-block-config, entity-decoded).
const turnpike: NjtaCamera = {
  id: 981, lat: 40.67, lng: -74.18381667, mile_marker: 101.6, relative_direction: 'north', relative_icon: 'exit',
  relative_text: 'Newark Liberty International Airport/US 1&9 (Elizabeth)',
  video_url: 'https://wink.njta.com/203/public/hls/WF05-24AF-4D24-585A-AC74_nj.m3u8', section: '', type: 'camera',
} as NjtaCamera;

const parkway: NjtaCamera = {
  id: 1060, lat: 39.99633333, lng: -74.20733333, mile_marker: 84.7, relative_direction: 'north', relative_icon: 'exit',
  relative_text: '(Dover Twp)',
  video_url: 'https://wink.njta.com/200/public/hls/WF05-24A0-4D14-028A-062F_nj.m3u8', section: 'south', type: 'camera',
} as NjtaCamera;

// Verbatim attribute markup, cut down to one row per road.
const PAGE = '<div class="alignwide wp-block-njta-theme-map-block" data-current-tab="turnpike" data-block-config="'
  + '{&quot;mode&quot;:&quot;traffic-cameras&quot;,&quot;initialData&quot;:{&quot;cameras&quot;:{&quot;turnpike&quot;:['
  + '{&quot;id&quot;:981,&quot;lat&quot;:40.67,&quot;lng&quot;:-74.18381667,&quot;mile_marker&quot;:101.6,&quot;relative_direction&quot;:&quot;north&quot;,&quot;relative_icon&quot;:&quot;exit&quot;,&quot;relative_text&quot;:&quot;Newark Liberty International Airport\\/US 1&amp;9 (Elizabeth)&quot;,&quot;video_url&quot;:&quot;https:\\/\\/wink.njta.com\\/203\\/public\\/hls\\/WF05-24AF-4D24-585A-AC74_nj.m3u8&quot;,&quot;section&quot;:&quot;&quot;,&quot;type&quot;:&quot;camera&quot;}'
  + '],&quot;parkway&quot;:['
  + '{&quot;id&quot;:1060,&quot;lat&quot;:39.99633333,&quot;lng&quot;:-74.20733333,&quot;mile_marker&quot;:84.7,&quot;relative_direction&quot;:&quot;north&quot;,&quot;relative_icon&quot;:&quot;exit&quot;,&quot;relative_text&quot;:&quot;(Dover Twp)&quot;,&quot;video_url&quot;:&quot;https:\\/\\/wink.njta.com\\/200\\/public\\/hls\\/WF05-24A0-4D14-028A-062F_nj.m3u8&quot;,&quot;section&quot;:&quot;south&quot;,&quot;type&quot;:&quot;camera&quot;}'
  + ']},&quot;service-areas&quot;:{}}}"></div>';

describe('mapNjtaCamera', () => {
  it('maps a Turnpike camera to its HLS stream, with the town as the caption', () => {
    expect(mapNjtaCamera(turnpike, 'turnpike')).toEqual({
      id: 'njta-981',
      lat: 40.67,
      lng: -74.18381667,
      name: 'NJ Turnpike MM 101.6 · North of Newark Liberty International Airport/US 1&9',
      city: 'Elizabeth',
      country: 'US',
      stream_url: 'https://wink.njta.com/203/public/hls/WF05-24AF-4D24-585A-AC74_nj.m3u8',
      stream_type: 'hls',
      source: 'NJTA',
    });
  });

  it('names a Parkway camera with only a town by road and milepost', () => {
    expect(mapNjtaCamera(parkway, 'parkway')).toMatchObject({ name: 'Garden State Pkwy MM 84.7', city: 'Dover Twp' });
  });

  it('keeps labels that already carry a milepost or a direction as they are', () => {
    expect(mapNjtaCamera({
      ...turnpike, mile_marker: 106.5, relative_text: 'MM 106.5 E Spur North of Southern Mixing Bowl',
    }, 'turnpike')?.name).toBe('NJ Turnpike · MM 106.5 E Spur North of Southern Mixing Bowl');
    expect(mapNjtaCamera({
      ...parkway, mile_marker: 152.5, relative_text: 'Northbound North of Exit 151 - Watchung St (Bloomfield)',
    }, 'parkway')?.name).toBe('Garden State Pkwy MM 152.5 · Northbound North of Exit 151 - Watchung St');
  });

  it('copes with a missing milepost or direction', () => {
    expect(mapNjtaCamera({
      ...turnpike, mile_marker: null, relative_direction: '', relative_text: 'Hudson County Ext. Interchange 14.2',
    }, 'turnpike')).toMatchObject({ name: 'NJ Turnpike · Hudson County Ext. Interchange 14.2', city: 'New Jersey' });
  });

  it('drops rows that are not cameras, lack an id, or sit outside New Jersey', () => {
    expect(mapNjtaCamera({ ...turnpike, type: 'service-area' }, 'turnpike')).toBeNull();
    expect(mapNjtaCamera({ ...turnpike, id: null }, 'turnpike')).toBeNull();
    expect(mapNjtaCamera({ ...turnpike, lat: 0, lng: 0 }, 'turnpike')).toBeNull();
    expect(mapNjtaCamera({ ...turnpike, lat: null }, 'turnpike')).toBeNull();
    expect(mapNjtaCamera(null, 'turnpike')).toBeNull();
  });

  it('drops rows without an https stream', () => {
    expect(mapNjtaCamera({ ...turnpike, video_url: 'http://wink.njta.com/203/public/hls/x_nj.m3u8' }, 'turnpike')).toBeNull();
    expect(mapNjtaCamera({ ...turnpike, video_url: null }, 'turnpike')).toBeNull();
  });
});

describe('parseNjtaPage', () => {
  it('reads both roads from the map block, decoding entities', () => {
    expect(parseNjtaPage(PAGE)).toEqual({ turnpike: [turnpike], parkway: [parkway] });
  });

  it('throws when the map config is missing or a road is empty', () => {
    expect(() => parseNjtaPage('<html></html>')).toThrow(/no traffic-cameras map config/);
    expect(() => parseNjtaPage(PAGE.replace(/&quot;parkway&quot;:\[.*?\]\}/, '&quot;parkway&quot;:[]}'))).toThrow(/missing/);
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

liveIt('fetches a large set of well-formed NJTA cameras', async () => {
  const cams = await fetchNjtaCameras();
  expect(cams.length).toBeGreaterThan(105);
  expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  const b = NJTA_BOUNDS;
  for (const c of cams) {
    expect(c.id).toMatch(/^njta-\d+$/);
    expect(c.source).toBe('NJTA');
    expect(c.stream_url).toMatch(/^https:\/\/wink\.njta\.com\/.+\.m3u8$/);
    expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
  }
}, 20_000);

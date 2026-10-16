import { describe, it, expect } from 'vitest';
import { mapSeattleCamera, fetchSeattleCameras, type SeattleFeature } from './seattle';

// Verbatim from web.seattle.gov/Travelers/api/Map/Data?zoomId=19&type=2: two views on one corner.
const pike: SeattleFeature = {
  PointCoordinate: [47.6092677059871, -122.338887741432],
  Cameras: [
    { Id: 'CMR-0302', Description: '2nd Ave & Pike St NS', ImageUrl: '2_Pike_NS.jpg', Type: 'sdot' },
    { Id: 'CMR-0303', Description: '2nd Ave & Pike St EW', ImageUrl: '2_Pike_EW.jpg', Type: 'sdot' },
  ],
};

// Verbatim: a WSDOT camera the city lists, and the one SDOT camera wsdot.ts also carries.
const raye: SeattleFeature = {
  PointCoordinate: [47.6429973969194, -122.347158115227],
  Cameras: [{ Id: 'SR99Raye', Description: 'SR-99 @ Raye St', ImageUrl: '099vc03415.jpg', Type: 'wsdot' }],
};
const fauntleroy: SeattleFeature = {
  PointCoordinate: [47.526783365445, -122.392755787503],
  Cameras: [{ Id: 'CMR-0112', Description: 'Fauntleroy Way SW & SW Cloverdale St', ImageUrl: 'Fauntleroy_SW_Cloverdale_NS.jpg', Type: 'sdot' }],
};

const cam = (f: SeattleFeature, i = 0) => f.Cameras![i];

describe('mapSeattleCamera', () => {
  it('maps a camera, reading the point latitude first', () => {
    expect(mapSeattleCamera(pike.PointCoordinate, cam(pike))).toEqual({
      id: 'seattle-CMR-0302',
      lat: 47.6092677059871,
      lng: -122.338887741432,
      name: '2nd Ave & Pike St NS',
      city: 'Seattle',
      country: 'US',
      feed_url: 'https://www.seattle.gov/trafficcams/images/2_Pike_NS.jpg',
      stream_type: 'jpg',
      source: 'SDOT',
    });
    expect(mapSeattleCamera(pike.PointCoordinate, cam(pike, 1))?.id).toBe('seattle-CMR-0303');
  });

  it('accepts non-numeric SDOT ids', () => {
    // Verbatim: a portable camera.
    expect(mapSeattleCamera([47.6075043344138, -122.329591139685],
      { Id: 'CMR-T03', Description: 'Madison St & 7th Ave', ImageUrl: 'SDOT_Portable_3.jpg', Type: 'sdot' })?.id).toBe('seattle-CMR-T03');
  });

  it('leaves cameras wsdot.ts carries to it', () => {
    expect(mapSeattleCamera(raye.PointCoordinate, cam(raye))).toBeNull();
    expect(mapSeattleCamera(fauntleroy.PointCoordinate, cam(fauntleroy))).toBeNull();
  });

  it('drops points outside Seattle, swapped or missing', () => {
    expect(mapSeattleCamera([-122.338887741432, 47.6092677059871], cam(pike))).toBeNull();
    expect(mapSeattleCamera([0, 0], cam(pike))).toBeNull();
    expect(mapSeattleCamera([null, null], cam(pike))).toBeNull();
    expect(mapSeattleCamera(null, cam(pike))).toBeNull();
  });

  it('drops rows without a usable id or image file', () => {
    expect(mapSeattleCamera(pike.PointCoordinate, { ...cam(pike), Id: null })).toBeNull();
    expect(mapSeattleCamera(pike.PointCoordinate, { ...cam(pike), ImageUrl: '../2_Pike_NS.jpg' })).toBeNull();
    expect(mapSeattleCamera(pike.PointCoordinate, { ...cam(pike), ImageUrl: 'https://evil.example/a.jpg' })).toBeNull();
    // Verbatim: one WSDOT row's file has no extension.
    expect(mapSeattleCamera(pike.PointCoordinate, { ...cam(pike), ImageUrl: '005vc16562' })).toBeNull();
  });

  it('falls back to a default name', () => {
    expect(mapSeattleCamera(pike.PointCoordinate, { ...cam(pike), Description: ' ' })?.name).toBe('SDOT Camera CMR-0302');
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

liveIt('fetches a large set of well-formed SDOT cameras', async () => {
  const cams = await fetchSeattleCameras();
  expect(cams.length).toBeGreaterThan(300);
  expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  for (const c of cams) {
    expect(c.id).toMatch(/^seattle-[\w-]+$/);
    expect(c.source).toBe('SDOT');
    expect(c.feed_url).toMatch(/^https:\/\/www\.seattle\.gov\/trafficcams\/images\/[\w.-]+\.jpg$/i);
  }
  // Clustering would stack many cameras on one point.
  const perPoint = new Map<string, number>();
  for (const c of cams) perPoint.set(`${c.lat},${c.lng}`, (perPoint.get(`${c.lat},${c.lng}`) ?? 0) + 1);
  expect(Math.max(...perPoint.values())).toBeLessThanOrEqual(3);
});
